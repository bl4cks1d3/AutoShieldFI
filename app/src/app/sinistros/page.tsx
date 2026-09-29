"use client";

import { Camera, CheckCircle2, Circle, FileText, FileWarning, Hash, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { ClaimStatusChip, Empty, EvidenceLink, Loading, PageHeader, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtMoney, shortAddr, toBase } from "@/lib/format";
import { kindLabel, useI18n } from "@/lib/i18n";
import { expectedPayout, TIER_COVERS } from "@/lib/pricing";
import { displayPlate, policyPhase } from "@/lib/plate";
import type { ClaimInfo, ClaimKind, PolicyInfo } from "@/lib/types";

export default function SinistrosPage() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t("Sinistros", "Claims")}
        subtitle={t(
          "Registre ocorrências e acompanhe cada etapa da análise on-chain.",
          "Report incidents and follow every step of the on-chain review.",
        )}
      />
      <WalletGate>
        <Suspense fallback={<Loading />}>
          <ClaimsView />
        </Suspense>
      </WalletGate>
    </div>
  );
}

function ClaimsView() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, loading } = useData(
    async (c) => ({
      policies: await c.getPolicies(c.wallet!),
      claims: await c.getClaims(c.wallet!),
      pool: await c.getPool(),
      now: await c.now(),
    }),
    [client.wallet],
  );

  if (loading && !data) return <Loading />;
  if (!data) return null;

  const eligible = data.policies.filter(
    (p) => policyPhase(p, data.now, data.pool?.params.installmentGraceSecs ?? 0) === "covered" && !p.hasOpenClaim && p.coverageLimit > p.totalPaidOut,
  );
  const blocked = data.policies.filter((p) =>
    ["inspection", "waiting", "overdue"].includes(policyPhase(p, data.now, data.pool?.params.installmentGraceSecs ?? 0)),
  );
  const policyById = new Map(data.policies.map((p) => [p.address, p]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <ClaimForm policies={eligible} />
        {blocked.length > 0 && (
          <div className="card p-4 text-sm text-[var(--muted)]">
            {blocked.map((p) => (
              <p key={p.address}>
                <b className="text-[var(--fg)]">{displayPlate(p)}</b> ·{" "}
                {!p.inspected
                  ? t("aguardando vistoria de um avaliador", "awaiting an assessor inspection")
                  : data.now < p.claimsAllowedFrom
                    ? t(`em carência até ${fmtDate(p.claimsAllowedFrom)}`, `waiting period until ${fmtDate(p.claimsAllowedFrom)}`)
                    : t("parcela em atraso: pague para voltar a ter cobertura", "installment overdue: pay it to restore coverage")}
              </p>
            ))}
          </div>
        )}
      </div>
      <section>
        <h2 className="mb-3 font-semibold">{t("Meus sinistros", "My claims")}</h2>
        {data.claims.length === 0 ? (
          <Empty icon={<FileText className="size-6" />} title={t("Nenhum sinistro registrado", "No claims filed")}>
            <p>
              {t(
                "Esperamos que continue assim! Se algo acontecer, registre aqui em minutos.",
                "We hope it stays that way! If something happens, file it here in minutes.",
              )}
            </p>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {data.claims.map((c) => (
              <ClaimCard
                key={c.address}
                c={c}
                policy={policyById.get(c.policy)}
                threshold={data.pool?.approvalThreshold ?? 0}
                now={data.now}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ClaimForm({ policies }: { policies: PolicyInfo[] }) {
  const params = useSearchParams();
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();
  const [policyAddr, setPolicyAddr] = useState("");
  const [kind, setKind] = useState<ClaimKind>("collision");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [evidence, setEvidence] = useState("");
  const [ipfsEnabled, setIpfsEnabled] = useState(false);

  useEffect(() => {
    if (client.mode !== "chain") return;
    fetch("/api/evidence")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setIpfsEnabled(Boolean(d.enabled)))
      .catch(() => setIpfsEnabled(false));
  }, [client.mode]);

  useEffect(() => {
    const fromUrl = params.get("policy");
    if (fromUrl && policies.some((p) => p.address === fromUrl)) setPolicyAddr(fromUrl);
    else if (!policyAddr && policies[0]) setPolicyAddr(policies[0].address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies.length]);

  const policy = policies.find((p) => p.address === policyAddr);
  const kinds = policy ? TIER_COVERS[policy.tier] : [];

  useEffect(() => {
    if (policy && !kinds.includes(kind)) setKind(kinds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyAddr]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    let alive = true;
    (async () => {
      if (!files.length) return setEvidence("");
      // Hash de todas as evidencias: prova de integridade registrada on-chain.
      const hashes = await Promise.all(files.map(async (f) => sha256Hex(await f.arrayBuffer())));
      const combined = await sha256Hex(new TextEncoder().encode(hashes.join("")).buffer as ArrayBuffer);
      if (alive) setEvidence(`sha256:${combined}`);
    })();
    return () => {
      alive = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [files]);

  const amountBase = toBase(amount);
  const remaining = policy ? policy.coverageLimit - policy.totalPaidOut : 0;
  const est = policy ? expectedPayout(kind, amountBase, policy.deductible, remaining, policy.coverageLimit) : null;
  const payout = est?.payout ?? 0;
  const valid = policy && amountBase > 0 && amountBase <= remaining && description.trim().length >= 10;

  /** Envia os arquivos ao IPFS (se configurado) e monta a URI gravada on-chain. */
  const buildEvidenceUri = async (): Promise<string> => {
    if (!files.length) return "sem-anexos";
    if (!ipfsEnabled) return evidence;
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    const data = (await res.json()) as { uri?: string; error?: string };
    if (!res.ok || !data.uri) throw new Error(data.error ?? "Falha ao enviar evidências");
    // ipfs://CID#sha256:<hash dos arquivos> (cabe nos 200 caracteres on-chain)
    return `${data.uri}#${evidence}`;
  };

  const submit = async () => {
    if (!policy) return;
    const sig = await run(
      "claim",
      async () =>
        client.fileClaim(policy.address, {
          kind,
          amount: amountBase,
          description: description.trim().slice(0, 200),
          evidenceUri: await buildEvidenceUri(),
        }),
      t("Sinistro registrado! Aguardando avaliadores.", "Claim filed! Waiting for assessors."),
    );
    if (sig) {
      setAmount("");
      setDescription("");
      setFiles([]);
    }
  };

  if (!policies.length)
    return (
      <Empty icon={<FileWarning className="size-6" />} title={t("Nenhuma apólice apta", "No eligible policy")}>
        <p>
          {t(
            "É preciso ter uma apólice vistoriada, fora da carência e sem sinistro em aberto para registrar uma ocorrência.",
            "You need an inspected policy, past its waiting period and with no open claim, to file an incident.",
          )}
        </p>
        <Link href="/cotar" className="btn btn-primary mt-4">
          {t("Contratar proteção", "Get covered")}
        </Link>
      </Empty>
    );

  return (
    <section className="card p-5 lg:self-start">
      <h2 className="flex items-center gap-2 font-semibold">
        <FileWarning className="size-5 text-[var(--accent)]" /> {t("Registrar sinistro", "File a claim")}
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="policy">{t("Apólice", "Policy")}</label>
          <select id="policy" className="input" value={policyAddr} onChange={(e) => setPolicyAddr(e.target.value)}>
            {policies.map((p) => (
              <option key={p.address} value={p.address}>
                #{p.id} · {displayPlate(p)} · {p.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">{t("Tipo de ocorrência", "Incident type")}</span>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`chip border py-1.5 ${kind === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
              >
                {kindLabel(k, lang)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="amount">{t("Valor estimado do prejuízo (R$)", "Estimated loss (R$)")}</label>
          <input
            id="amount"
            className="input num"
            inputMode="decimal"
            placeholder={t("Ex.: 8000", "e.g. 8000")}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />
          {amountBase > remaining && <p className="mt-1 text-xs text-[var(--bad)]">{t("Acima da cobertura restante", "Above the remaining coverage")} ({fmtMoney(remaining)})</p>}
        </div>
        <div>
          <label className="label" htmlFor="desc">{t("Descrição do ocorrido", "What happened")}</label>
          <textarea
            id="desc"
            className="input min-h-24"
            maxLength={200}
            placeholder={t(
              "Data, local e o que aconteceu. Inclua nº do B.O. em caso de roubo.",
              "Date, place and what happened. Include the police report number for theft.",
            )}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{description.length}/200</p>
        </div>
        <div>
          <span className="label">{t("Evidências (fotos, B.O., orçamento)", "Evidence (photos, police report, repair estimate)")}</span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)] hover:border-[var(--accent)]">
            <Camera className="size-4" /> {t("Adicionar arquivos", "Add files")}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
            />
          </label>
          {previews.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {previews.map((src, i) =>
                files[i]?.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <div key={src} className="grid aspect-square place-items-center rounded-lg bg-[var(--bg-soft)] text-xs">PDF</div>
                ),
              )}
            </div>
          )}
          {evidence && (
            <p className="mt-2 flex items-center gap-1 break-all font-mono text-xs text-[var(--muted)]">
              <Hash className="size-3 shrink-0" /> {evidence.slice(0, 30)}…
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--muted)]">
            {ipfsEnabled
              ? t(
                  "Os arquivos vão para o IPFS e o link + hash SHA-256 ficam gravados on-chain. Evite fotos com dados de terceiros: o IPFS é público.",
                  "Files go to IPFS and the link + SHA-256 hash are recorded on-chain. Avoid photos with other people's data: IPFS is public.",
                )
              : t(
                  "O hash SHA-256 dos arquivos é gravado on-chain como prova de integridade.",
                  "The files' SHA-256 hash is recorded on-chain as proof of integrity.",
                )}
          </p>
        </div>

        {policy && amountBase > 0 && (
          <div className="rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
            <Row label={t("Valor solicitado", "Amount requested")} value={fmtMoney(amountBase)} />
            <Row
              label={t("Franquia", "Deductible")}
              value={est?.totalLoss ? t("isento (perda total)", "waived (total loss)") : `− ${fmtMoney(policy.deductible)}`}
            />
            <Row label={t("Indenização estimada", "Estimated payout")} value={fmtMoney(payout)} strong />
            {est?.totalLoss && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {kind === "theft"
                  ? t(
                      "Roubo e furto são indenizados como perda total: o valor coberto pela FIPE vigente, sem franquia. A apólice é encerrada após o pagamento.",
                      "Theft is paid as a total loss: the covered amount at the current FIPE value, with no deductible. The policy ends after the payout.",
                    )
                  : t(
                      "Dano a partir de 75% do valor coberto é perda total: indenização integral pela FIPE vigente, sem franquia. A apólice é encerrada após o pagamento.",
                      "Damage of 75% or more of the covered amount is a total loss: full payout at the current FIPE value, with no deductible. The policy ends after the payout.",
                    )}
              </p>
            )}
          </div>
        )}

        <button className="btn btn-primary" disabled={!valid || !!busy} onClick={submit}>
          {busy === "claim" && <Spinner />} {t("Enviar para avaliação", "Submit for review")}
        </button>
      </div>
    </section>
  );
}

function ClaimCard({ c, policy, threshold, now }: { c: ClaimInfo; policy?: PolicyInfo; threshold: number; now: number }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const { lang, t } = useI18n();

  const steps = useMemo(() => {
    const decided = c.status !== "pending";
    return [
      { label: t("Registrado on-chain", "Recorded on-chain"), done: true, ts: c.createdTs },
      {
        label:
          c.status === "rejected"
            ? t(`Recusado (${c.rejections} votos contra)`, `Rejected (${c.rejections} votes against)`)
            : t(`Votação dos avaliadores (${c.approvals}/${threshold})`, `Assessor vote (${c.approvals}/${threshold})`),
        done: decided,
        bad: c.status === "rejected",
        ts: decided ? c.resolvedTs : 0,
      },
      ...(c.status === "rejected"
        ? []
        : [
            { label: t("Aprovado", "Approved"), done: c.status === "approved" || c.status === "paid", ts: 0 },
            {
              label: c.status === "paid" ? `${t("Pago", "Paid")}: ${fmtMoney(c.payoutAmount)}` : t("Pagamento", "Payment"),
              done: c.status === "paid",
              ts: c.status === "paid" ? c.resolvedTs : 0,
            },
          ]),
    ];
  }, [c, threshold, t]);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t("Sinistro", "Claim")} #{c.id} · {policy ? `${displayPlate(policy)}` : shortAddr(c.policy)}
          </p>
          <h3 className="mt-1 font-bold">{kindLabel(c.kind, lang)} · {fmtMoney(c.amountRequested)}</h3>
        </div>
        <ClaimStatusChip status={c.status} />
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{c.description}</p>
      {c.reclassified && (
        <p className="mt-1 text-xs text-[var(--warn)]">
          {t("Reclassificado pelos avaliadores: declarado como", "Reclassified by the assessors: originally filed as")}{" "}
          {kindLabel(c.originalKind, lang)}.
        </p>
      )}
      <div className="mt-2">
        <EvidenceLink uri={c.evidenceUri} />
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {s.bad ? (
              <XCircle className="size-4 text-[var(--bad)]" />
            ) : s.done ? (
              <CheckCircle2 className="size-4 text-[var(--ok)]" />
            ) : (
              <Circle className="size-4 text-[var(--muted)]" />
            )}
            <span className={s.done ? "" : "text-[var(--muted)]"}>{s.label}</span>
            {s.ts > 0 && <span className="ml-auto text-xs text-[var(--muted)]">{fmtDate(s.ts)}</span>}
          </li>
        ))}
      </ol>

      {c.status === "pending" && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          {t("Janela de votação", "Voting window")}:{" "}
          {now > c.votingDeadline
            ? t("encerrada", "closed")
            : t(`restam ${fmtDuration(c.votingDeadline - now)}`, `${fmtDuration(c.votingDeadline - now)} left`)}
        </p>
      )}

      {c.status === "approved" && (
        <button
          className="btn btn-primary mt-4 w-full"
          disabled={!!busy}
          onClick={() => run(`pay-${c.address}`, () => client.payClaim(c.address), t("Indenização recebida!", "Payout received!"))}
        >
          {busy === `pay-${c.address}` && <Spinner />} {t("Receber indenização", "Receive payout")}
        </button>
      )}
      {c.status === "pending" && now > c.votingDeadline && (
        <button
          className="btn btn-ghost mt-4 w-full"
          disabled={!!busy}
          onClick={() => run(`exp-${c.address}`, () => client.expireClaim(c.address), t("Sinistro encerrado por falta de quórum", "Claim closed for lack of quorum"))}
        >
          {t("Encerrar (sem quórum)", "Close (no quorum)")}
        </button>
      )}
    </div>
  );
}
