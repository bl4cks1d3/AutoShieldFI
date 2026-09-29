"use client";

import { ClipboardCheck, Gavel, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { displayPlate, plateHashHex } from "@/lib/plate";
import { useAction, useApp, useData } from "@/components/Providers";
import { ClaimStatusChip, Empty, EvidenceLink, Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtMoney, shortAddr } from "@/lib/format";
import { kindLabel, tierLabel, useI18n } from "@/lib/i18n";
import { expectedPayout, TIER_COVERS } from "@/lib/pricing";
import type { ClaimInfo, ClaimKind, ClaimStatus, PolicyInfo, PoolInfo } from "@/lib/types";

const FILTERS: { key: ClaimStatus | "all" | "inspection"; pt: string; en: string }[] = [
  { key: "inspection", pt: "Vistorias", en: "Inspections" },
  { key: "pending", pt: "Sinistros em análise", en: "Claims under review" },
  { key: "approved", pt: "Aprovados", en: "Approved" },
  { key: "all", pt: "Todos", en: "All" },
];

export default function AvaliacaoPage() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("Painel de avaliação", "Assessment panel")}
        subtitle={t(
          "Avaliadores do pool analisam evidências e votam cada sinistro on-chain.",
          "Pool assessors review evidence and vote on each claim on-chain.",
        )}
      />
      <WalletGate>
        <AssessorView />
      </WalletGate>
    </div>
  );
}

function AssessorView() {
  const { client } = useApp();
  const { lang, t } = useI18n();
  const [filter, setFilter] = useState<ClaimStatus | "all" | "inspection">("inspection");
  const [demoIdentity, setIdentity] = useState(client.assessorIdentities[0] ?? "");
  const identity = client.mode === "chain" ? (client.wallet ?? "") : demoIdentity;
  const { data, loading } = useData(async (c) => ({
    pool: await c.getPool(),
    claims: await c.getClaims(),
    policies: await c.getPolicies(),
    now: await c.now(),
  }));

  if (loading && !data) return <Loading />;
  if (!data?.pool) return <PoolMissing />;
  const { pool, claims, policies, now } = data;

  const isAssessor = pool.assessors.includes(identity);
  const policyById = new Map(policies.map((p) => [p.address, p]));
  const shown = claims.filter((c) => filter === "all" || c.status === filter);
  const toInspect = policies.filter((p) => p.status === "active" && !p.inspected);
  const count = (k: string) =>
    k === "inspection" ? toInspect.length : k === "all" ? claims.length : claims.filter((c) => c.status === k).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Gavel className="size-5 text-[var(--accent)]" />
          <span className="text-sm">
            {t("Quórum", "Quorum")}: <b>{pool.approvalThreshold}</b> {t("de", "of")} <b>{pool.assessors.length}</b>{" "}
            {t("avaliadores · você recebe", "assessors · you earn")}{" "}
            <b>{fmtMoney(Math.floor(pool.params.inspectionFee / Math.max(1, Math.min(pool.params.inspectionThreshold, pool.assessors.length))))}</b>{" "}
            {t("por voto de vistoria e até", "per inspection vote and up to")} <b>{fmtMoney(pool.params.voteReward)}</b>{" "}
            {t("por voto", "per vote")}
          </span>
        </div>
        {client.mode === "demo" ? (
          <label className="flex items-center gap-2 text-sm sm:ml-auto">
            <span className="text-[var(--muted)]">{t("Votar como", "Vote as")}</span>
            <select className="input !w-auto !py-1.5" value={identity} onChange={(e) => setIdentity(e.target.value)}>
              {client.assessorIdentities.map((a, i) => (
                <option key={a} value={a}>
                  {t("Avaliador", "Assessor")} {i + 1} ({t("simulado", "simulated")})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className={`text-sm sm:ml-auto ${isAssessor ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
            {isAssessor
              ? t("Sua carteira é avaliadora deste pool", "Your wallet is an assessor of this pool")
              : t("Sua carteira não é avaliadora — apenas leitura", "Your wallet is not an assessor — read only")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`chip border py-1.5 ${filter === f.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
          >
            {lang === "en" ? f.en : f.pt} ({count(f.key)})
          </button>
        ))}
      </div>

      {filter === "inspection" ? (
        toInspect.length === 0 ? (
          <Empty icon={<ClipboardCheck className="size-6" />} title={t("Nenhuma vistoria pendente", "No pending inspections")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {toInspect.map((p) => (
              <InspectionCard key={p.address} p={p} pool={pool} identity={identity} canAct={isAssessor} />
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <Empty icon={<ShieldAlert className="size-6" />} title={t("Nenhum sinistro nesta fila", "No claims in this queue")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => (
            <ReviewCard
              key={c.address}
              c={c}
              policy={policyById.get(c.policy)}
              pool={pool}
              identity={identity}
              canVote={isAssessor}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  c,
  policy,
  pool,
  identity,
  canVote,
  now,
}: {
  c: ClaimInfo;
  policy?: PolicyInfo;
  pool: PoolInfo;
  identity: string;
  canVote: boolean;
  now: number;
}) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const voted = c.voters.includes(identity);
  const ownClaim = c.claimant === identity;
  const [kind, setKind] = useState<ClaimKind>(c.kind);
  const open = c.status === "pending" && now <= c.votingDeadline;
  const payout = policy
    ? expectedPayout(open ? kind : c.kind, c.amountRequested, policy.deductible, policy.coverageLimit - policy.totalPaidOut)
    : 0;

  const vote = (approve: boolean) =>
    run(
      `vote-${c.address}`,
      () => client.vote(c.address, approve, identity, approve && kind !== c.kind ? kind : undefined),
      approve ? t("Voto de aprovação registrado", "Approval vote recorded") : t("Voto de recusa registrado", "Rejection vote recorded"),
    );

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t("Sinistro", "Claim")} #{c.id} · {fmtDate(c.createdTs)}
          </p>
          <h3 className="mt-1 font-bold">
            {kindLabel(c.kind, lang)} · {fmtMoney(c.amountRequested)}
          </h3>
          {c.reclassified && (
            <p className="text-xs text-[var(--warn)]">
              {t("Reclassificado (declarado como", "Reclassified (filed as")} {kindLabel(c.originalKind, lang)})
            </p>
          )}
        </div>
        <ClaimStatusChip status={c.status} />
      </div>
      <p className="mt-2 rounded-lg bg-[var(--bg-soft)] p-3 text-sm">{c.description}</p>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        {policy && (
          <>
            <Row label={t("Veículo", "Vehicle")} value={`${policy.model} · ${displayPlate(policy)}`} />
            <Row label={t("Plano", "Plan")} value={tierLabel(policy.tier, lang)} />
            <Row label={t("Cobertura restante", "Remaining coverage")} value={fmtMoney(policy.coverageLimit - policy.totalPaidOut)} />
          </>
        )}
        <Row label={t("Indenização se aprovado", "Payout if approved")} value={fmtMoney(payout)} strong />
        <Row label={t("Solicitante", "Claimant")} value={shortAddr(c.claimant)} />
        <Row label={t("Evidências", "Evidence")} value={<EvidenceLink uri={c.evidenceUri} />} />
        <Row
          label={t("Votos", "Votes")}
          value={t(`${c.approvals} a favor · ${c.rejections} contra`, `${c.approvals} for · ${c.rejections} against`)}
        />
        {c.status === "pending" && (
          <Row
            label={t("Prazo", "Deadline")}
            value={
              open
                ? t(`restam ${fmtDuration(c.votingDeadline - now)}`, `${fmtDuration(c.votingDeadline - now)} left`)
                : t("encerrado", "closed")
            }
          />
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {open && ownClaim && <p className="text-sm text-[var(--muted)]">
            {t("Sinistro da sua própria apólice: você não vota.", "This claim is on your own policy: you cannot vote.")}
          </p>}
        {open && canVote && !voted && !ownClaim && policy && (
          <label className="flex w-full items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">{t("Tipo ao aprovar", "Type when approving")}</span>
            <select className="input !w-auto flex-1 !py-1.5" value={kind} onChange={(e) => setKind(e.target.value as ClaimKind)}>
              {TIER_COVERS[policy.tier].map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k, lang)}
                  {k === c.kind ? ` (${t("declarado", "as filed")})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {open && canVote && !voted && !ownClaim && (
          <>
            <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => vote(true)}>
              {busy === `vote-${c.address}` ? <Spinner /> : <ThumbsUp className="size-4" />} {t("Aprovar", "Approve")}
            </button>
            <button className="btn btn-danger flex-1" disabled={!!busy} onClick={() => vote(false)}>
              <ThumbsDown className="size-4" /> {t("Recusar", "Reject")}
            </button>
          </>
        )}
        {open && voted && <p className="text-sm text-[var(--muted)]">{t("Você já votou neste sinistro.", "You have already voted on this claim.")}</p>}
        {c.status === "approved" && (
          <button
            className="btn btn-primary w-full"
            disabled={!!busy}
            onClick={() => run(`pay-${c.address}`, () => client.payClaim(c.address), t("Indenização paga ao motorista", "Payout sent to the driver"))}
          >
            {busy === `pay-${c.address}` && <Spinner />} {t("Executar pagamento", "Execute payout")}
          </button>
        )}
        {c.status === "pending" && !open && (
          <button
            className="btn btn-ghost w-full"
            disabled={!!busy}
            onClick={() => run(`exp-${c.address}`, () => client.expireClaim(c.address), t("Sinistro encerrado sem quórum", "Claim closed without quorum"))}
          >
            {t("Encerrar por falta de quórum", "Close for lack of quorum")}
          </button>
        )}
      </div>
      {pool.paused && <p className="mt-2 text-xs text-[var(--warn)]">{t("Protocolo pausado pela governança.", "Protocol paused by governance.")}</p>}
    </div>
  );
}

function InspectionCard({
  p,
  pool,
  identity,
  canAct,
}: {
  p: PolicyInfo;
  pool: PoolInfo;
  identity: string;
  canAct: boolean;
}) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const [typed, setTyped] = useState("");
  const own = p.owner === identity;
  const voted = p.inspectionVoters.includes(identity);
  const quorum = Math.max(1, Math.min(pool.params.inspectionThreshold, pool.assessors.length));
  // A placa nao esta on-chain: o avaliador digita a do documento e o app confere o hash.
  const plateOk = typed.trim().length > 0 && plateHashHex(typed) === p.plateHash;
  const act = (approve: boolean) =>
    run(`insp-${p.address}`, () => client.inspect(p.address, approve, identity), approve
        ? t("Voto de aprovação da vistoria registrado", "Inspection approval vote recorded")
        : t("Voto de recusa da vistoria registrado", "Inspection rejection vote recorded"),
    );

  return (
    <div className="card flex flex-col p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {t("Apólice", "Policy")} #{p.id} · {t("contratada em", "purchased on")} {fmtDate(p.startTs)}
      </p>
      <h3 className="mt-1 font-bold">{p.model}</h3>
      <p className="text-sm text-[var(--muted)]">
        <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-[var(--fg)]">{displayPlate(p)}</span> · {p.year}
      </p>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        <Row label={t("Valor FIPE declarado", "Declared FIPE value")} value={fmtMoney(p.vehicleValue)} strong />
        <Row label={t("Plano", "Plan")} value={tierLabel(p.tier, lang)} />
        <Row label={t("Prêmio pago", "Premium paid")} value={fmtMoney(p.premiumPaid)} />
        <Row label={t("Titular", "Policyholder")} value={shortAddr(p.owner)} />
        <Row
          label={t("Votos", "Votes")}
          value={t(
            `${p.inspectionApprovals} a favor · ${p.inspectionRejections} contra · quórum ${quorum}`,
            `${p.inspectionApprovals} for · ${p.inspectionRejections} against · quorum ${quorum}`,
          )}
        />
        <Row label={t("Sua parte da taxa", "Your share of the fee")} value={fmtMoney(Math.floor(p.inspectionFee / quorum))} />
      </div>
      {!own && canAct && !voted && (
        <label className="mt-3 block text-sm">
          <span className="label">{t("Placa do documento (CRLV)", "Plate on the registration document (CRLV)")}</span>
          <input
            className="input font-mono uppercase"
            placeholder="ABC1D23"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {typed && (
            <span className={`mt-1 block text-xs ${plateOk ? "text-[var(--ok)]" : "text-[var(--bad)]"}`}>
              {plateOk
                ? t("Placa confere com o hash registrado na apólice", "Plate matches the hash recorded on the policy")
                : t("Placa não confere com a apólice", "Plate does not match the policy")}
            </span>
          )}
        </label>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        {t(
          "Confira fotos do veículo, documento (CRLV) e se o valor declarado bate com a tabela FIPE. Recusar devolve o prêmio pago ao motorista; a taxa de vistoria é dividida entre os avaliadores que votarem.",
          "Check the vehicle photos, the registration document (CRLV) and whether the declared value matches the FIPE table. Rejecting refunds the premium paid to the driver; the inspection fee is split among the assessors who vote.",
        )}
      </p>
      <div className="mt-auto flex gap-2 pt-4">
        {own ? (
          <p className="text-sm text-[var(--muted)]">
            {t("Apólice sua: outro avaliador precisa vistoriar.", "This is your policy: another assessor must inspect it.")}
          </p>
        ) : voted ? (
          <p className="text-sm text-[var(--muted)]">
            {t("Você já votou; aguardando os demais avaliadores.", "You have voted; waiting for the other assessors.")}
          </p>
        ) : canAct ? (
          <>
            <button className="btn btn-primary flex-1" disabled={!!busy || !plateOk} onClick={() => act(true)}>
              {busy === `insp-${p.address}` ? <Spinner /> : <ThumbsUp className="size-4" />} {t("Aprovar vistoria", "Approve inspection")}
            </button>
            <button className="btn btn-danger flex-1" disabled={!!busy} onClick={() => act(false)}>
              <ThumbsDown className="size-4" /> {t("Recusar", "Reject")}
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t("Somente avaliadores podem vistoriar.", "Only assessors can inspect.")}</p>
        )}
      </div>
    </div>
  );
}
