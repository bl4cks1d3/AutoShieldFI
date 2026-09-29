"use client";

import { ClipboardCheck, Gavel, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { displayPlate, plateHashHex } from "@/lib/plate";
import { useAction, useApp, useData } from "@/components/Providers";
import { ClaimStatusChip, Empty, EvidenceLink, Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtMoney, KIND_LABEL, shortAddr, TIER_LABEL } from "@/lib/format";
import { expectedPayout, TIER_COVERS } from "@/lib/pricing";
import type { ClaimInfo, ClaimKind, ClaimStatus, PolicyInfo, PoolInfo } from "@/lib/types";

const FILTERS: { key: ClaimStatus | "all" | "inspection"; label: string }[] = [
  { key: "inspection", label: "Vistorias" },
  { key: "pending", label: "Sinistros em análise" },
  { key: "approved", label: "Aprovados" },
  { key: "all", label: "Todos" },
];

export default function AvaliacaoPage() {
  return (
    <div>
      <PageHeader
        title="Painel de avaliação"
        subtitle="Avaliadores do pool analisam evidências e votam cada sinistro on-chain."
      />
      <WalletGate>
        <AssessorView />
      </WalletGate>
    </div>
  );
}

function AssessorView() {
  const { client } = useApp();
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
            Quórum: <b>{pool.approvalThreshold}</b> de <b>{pool.assessors.length}</b> avaliadores · você recebe{" "}
            <b>{fmtMoney(Math.floor(pool.params.inspectionFee / Math.max(1, Math.min(pool.params.inspectionThreshold, pool.assessors.length))))}</b> por voto de vistoria e até <b>{fmtMoney(pool.params.voteReward)}</b> por
            voto
          </span>
        </div>
        {client.mode === "demo" ? (
          <label className="flex items-center gap-2 text-sm sm:ml-auto">
            <span className="text-[var(--muted)]">Votar como</span>
            <select className="input !w-auto !py-1.5" value={identity} onChange={(e) => setIdentity(e.target.value)}>
              {client.assessorIdentities.map((a, i) => (
                <option key={a} value={a}>
                  Avaliador {i + 1} (simulado)
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className={`text-sm sm:ml-auto ${isAssessor ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
            {isAssessor ? "Sua carteira é avaliadora deste pool" : "Sua carteira não é avaliadora — apenas leitura"}
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
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      {filter === "inspection" ? (
        toInspect.length === 0 ? (
          <Empty icon={<ClipboardCheck className="size-6" />} title="Nenhuma vistoria pendente" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {toInspect.map((p) => (
              <InspectionCard key={p.address} p={p} pool={pool} identity={identity} canAct={isAssessor} />
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <Empty icon={<ShieldAlert className="size-6" />} title="Nenhum sinistro nesta fila" />
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
      approve ? "Voto de aprovação registrado" : "Voto de recusa registrado",
    );

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sinistro #{c.id} · {fmtDate(c.createdTs)}
          </p>
          <h3 className="mt-1 font-bold">
            {KIND_LABEL[c.kind]} · {fmtMoney(c.amountRequested)}
          </h3>
          {c.reclassified && (
            <p className="text-xs text-[var(--warn)]">Reclassificado (declarado como {KIND_LABEL[c.originalKind]})</p>
          )}
        </div>
        <ClaimStatusChip status={c.status} />
      </div>
      <p className="mt-2 rounded-lg bg-[var(--bg-soft)] p-3 text-sm">{c.description}</p>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        {policy && (
          <>
            <Row label="Veículo" value={`${policy.model} · ${displayPlate(policy)}`} />
            <Row label="Plano" value={TIER_LABEL[policy.tier]} />
            <Row label="Cobertura restante" value={fmtMoney(policy.coverageLimit - policy.totalPaidOut)} />
          </>
        )}
        <Row label="Indenização se aprovado" value={fmtMoney(payout)} strong />
        <Row label="Solicitante" value={shortAddr(c.claimant)} />
        <Row label="Evidências" value={<EvidenceLink uri={c.evidenceUri} />} />
        <Row label="Votos" value={`${c.approvals} a favor · ${c.rejections} contra`} />
        {c.status === "pending" && (
          <Row label="Prazo" value={open ? `restam ${fmtDuration(c.votingDeadline - now)}` : "encerrado"} />
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {open && ownClaim && <p className="text-sm text-[var(--muted)]">Sinistro da sua própria apólice: você não vota.</p>}
        {open && canVote && !voted && !ownClaim && policy && (
          <label className="flex w-full items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Tipo ao aprovar</span>
            <select className="input !w-auto flex-1 !py-1.5" value={kind} onChange={(e) => setKind(e.target.value as ClaimKind)}>
              {TIER_COVERS[policy.tier].map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                  {k === c.kind ? " (declarado)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {open && canVote && !voted && !ownClaim && (
          <>
            <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => vote(true)}>
              {busy === `vote-${c.address}` ? <Spinner /> : <ThumbsUp className="size-4" />} Aprovar
            </button>
            <button className="btn btn-danger flex-1" disabled={!!busy} onClick={() => vote(false)}>
              <ThumbsDown className="size-4" /> Recusar
            </button>
          </>
        )}
        {open && voted && <p className="text-sm text-[var(--muted)]">Você já votou neste sinistro.</p>}
        {c.status === "approved" && (
          <button
            className="btn btn-primary w-full"
            disabled={!!busy}
            onClick={() => run(`pay-${c.address}`, () => client.payClaim(c.address), "Indenização paga ao motorista")}
          >
            {busy === `pay-${c.address}` && <Spinner />} Executar pagamento
          </button>
        )}
        {c.status === "pending" && !open && (
          <button
            className="btn btn-ghost w-full"
            disabled={!!busy}
            onClick={() => run(`exp-${c.address}`, () => client.expireClaim(c.address), "Sinistro encerrado sem quórum")}
          >
            Encerrar por falta de quórum
          </button>
        )}
      </div>
      {pool.paused && <p className="mt-2 text-xs text-[var(--warn)]">Protocolo pausado pela governança.</p>}
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
  const [typed, setTyped] = useState("");
  const own = p.owner === identity;
  const voted = p.inspectionVoters.includes(identity);
  const quorum = Math.max(1, Math.min(pool.params.inspectionThreshold, pool.assessors.length));
  // A placa nao esta on-chain: o avaliador digita a do documento e o app confere o hash.
  const plateOk = typed.trim().length > 0 && plateHashHex(typed) === p.plateHash;
  const act = (approve: boolean) =>
    run(`insp-${p.address}`, () => client.inspect(p.address, approve, identity), approve ? "Voto de aprovação da vistoria registrado" : "Voto de recusa da vistoria registrado");

  return (
    <div className="card flex flex-col p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Apólice #{p.id} · contratada em {fmtDate(p.startTs)}
      </p>
      <h3 className="mt-1 font-bold">{p.model}</h3>
      <p className="text-sm text-[var(--muted)]">
        <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-[var(--fg)]">{displayPlate(p)}</span> · {p.year}
      </p>
      <div className="mt-3 divide-y divide-[var(--border)] text-sm">
        <Row label="Valor FIPE declarado" value={fmtMoney(p.vehicleValue)} strong />
        <Row label="Plano" value={TIER_LABEL[p.tier]} />
        <Row label="Prêmio pago" value={fmtMoney(p.premiumPaid)} />
        <Row label="Titular" value={shortAddr(p.owner)} />
        <Row label="Votos" value={`${p.inspectionApprovals} a favor · ${p.inspectionRejections} contra · quórum ${quorum}`} />
        <Row label="Sua parte da taxa" value={fmtMoney(Math.floor(p.inspectionFee / quorum))} />
      </div>
      {!own && canAct && !voted && (
        <label className="mt-3 block text-sm">
          <span className="label">Placa do documento (CRLV)</span>
          <input
            className="input font-mono uppercase"
            placeholder="ABC1D23"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {typed && (
            <span className={`mt-1 block text-xs ${plateOk ? "text-[var(--ok)]" : "text-[var(--bad)]"}`}>
              {plateOk ? "Placa confere com o hash registrado na apólice" : "Placa não confere com a apólice"}
            </span>
          )}
        </label>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Confira fotos do veículo, documento (CRLV) e se o valor declarado bate com a tabela FIPE. Recusar devolve o
        prêmio pago ao motorista; a taxa de vistoria é dividida entre os avaliadores que votarem.
      </p>
      <div className="mt-auto flex gap-2 pt-4">
        {own ? (
          <p className="text-sm text-[var(--muted)]">Apólice sua: outro avaliador precisa vistoriar.</p>
        ) : voted ? (
          <p className="text-sm text-[var(--muted)]">Você já votou; aguardando os demais avaliadores.</p>
        ) : canAct ? (
          <>
            <button className="btn btn-primary flex-1" disabled={!!busy || !plateOk} onClick={() => act(true)}>
              {busy === `insp-${p.address}` ? <Spinner /> : <ThumbsUp className="size-4" />} Aprovar vistoria
            </button>
            <button className="btn btn-danger flex-1" disabled={!!busy} onClick={() => act(false)}>
              <ThumbsDown className="size-4" /> Recusar
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Somente avaliadores podem vistoriar.</p>
        )}
      </div>
    </div>
  );
}
