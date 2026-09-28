"use client";

import { Camera, CheckCircle2, Circle, FileText, FileWarning, Hash, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { ClaimStatusChip, Empty, Loading, PageHeader, Row, Spinner, WalletGate } from "@/components/ui";
import { fmtDate, fmtDuration, fmtMoney, KIND_LABEL, shortAddr, toBase } from "@/lib/format";
import { expectedPayout, TIER_COVERS } from "@/lib/pricing";
import type { ClaimInfo, ClaimKind, PolicyInfo } from "@/lib/types";

export default function SinistrosPage() {
  return (
    <div>
      <PageHeader title="Sinistros" subtitle="Registre ocorrências e acompanhe cada etapa da análise on-chain." />
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
    (p) => p.status === "active" && !p.hasOpenClaim && data.now <= p.endTs && p.coverageLimit > p.totalPaidOut,
  );
  const policyById = new Map(data.policies.map((p) => [p.address, p]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <ClaimForm policies={eligible} />
      <section>
        <h2 className="mb-3 font-semibold">Meus sinistros</h2>
        {data.claims.length === 0 ? (
          <Empty icon={<FileText className="size-6" />} title="Nenhum sinistro registrado">
            <p>Esperamos que continue assim! Se algo acontecer, registre aqui em minutos.</p>
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
  const [policyAddr, setPolicyAddr] = useState("");
  const [kind, setKind] = useState<ClaimKind>("collision");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [evidence, setEvidence] = useState("");

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
  const payout = policy ? expectedPayout(kind, amountBase, policy.deductible, remaining) : 0;
  const valid = policy && amountBase > 0 && amountBase <= remaining && description.trim().length >= 10;

  const submit = async () => {
    if (!policy) return;
    const sig = await run(
      "claim",
      () =>
        client.fileClaim(policy.address, {
          kind,
          amount: amountBase,
          description: description.trim().slice(0, 200),
          evidenceUri: evidence || "sem-anexos",
        }),
      "Sinistro registrado! Aguardando avaliadores.",
    );
    if (sig) {
      setAmount("");
      setDescription("");
      setFiles([]);
    }
  };

  if (!policies.length)
    return (
      <Empty icon={<FileWarning className="size-6" />} title="Nenhuma apólice apta">
        <p>É preciso ter uma apólice vigente e sem sinistro em aberto para registrar uma ocorrência.</p>
        <Link href="/cotar" className="btn btn-primary mt-4">
          Contratar proteção
        </Link>
      </Empty>
    );

  return (
    <section className="card p-5 lg:self-start">
      <h2 className="flex items-center gap-2 font-semibold">
        <FileWarning className="size-5 text-[var(--accent)]" /> Registrar sinistro
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="policy">Apólice</label>
          <select id="policy" className="input" value={policyAddr} onChange={(e) => setPolicyAddr(e.target.value)}>
            {policies.map((p) => (
              <option key={p.address} value={p.address}>
                #{p.id} · {p.plate} · {p.model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Tipo de ocorrência</span>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`chip border py-1.5 ${kind === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="amount">Valor estimado do prejuízo (R$)</label>
          <input
            id="amount"
            className="input num"
            inputMode="decimal"
            placeholder="Ex.: 8000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />
          {amountBase > remaining && <p className="mt-1 text-xs text-[var(--bad)]">Acima da cobertura restante ({fmtMoney(remaining)})</p>}
        </div>
        <div>
          <label className="label" htmlFor="desc">Descrição do ocorrido</label>
          <textarea
            id="desc"
            className="input min-h-24"
            maxLength={200}
            placeholder="Data, local e o que aconteceu. Inclua nº do B.O. em caso de roubo."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{description.length}/200</p>
        </div>
        <div>
          <span className="label">Evidências (fotos, B.O., orçamento)</span>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)] hover:border-[var(--accent)]">
            <Camera className="size-4" /> Adicionar arquivos
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
            O hash SHA-256 dos arquivos é gravado on-chain como prova de integridade.
          </p>
        </div>

        {policy && amountBase > 0 && (
          <div className="rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
            <Row label="Valor solicitado" value={fmtMoney(amountBase)} />
            <Row
              label="Franquia"
              value={kind === "theft" || kind === "naturalEvent" ? "isento (perda total)" : `− ${fmtMoney(policy.deductible)}`}
            />
            <Row label="Indenização estimada" value={fmtMoney(payout)} strong />
          </div>
        )}

        <button className="btn btn-primary" disabled={!valid || !!busy} onClick={submit}>
          {busy === "claim" && <Spinner />} Enviar para avaliação
        </button>
      </div>
    </section>
  );
}

function ClaimCard({ c, policy, threshold, now }: { c: ClaimInfo; policy?: PolicyInfo; threshold: number; now: number }) {
  const { client } = useApp();
  const { run, busy } = useAction();

  const steps = useMemo(() => {
    const decided = c.status !== "pending";
    return [
      { label: "Registrado on-chain", done: true, ts: c.createdTs },
      {
        label:
          c.status === "rejected"
            ? `Recusado (${c.rejections} votos contra)`
            : `Votação dos avaliadores (${c.approvals}/${threshold})`,
        done: decided,
        bad: c.status === "rejected",
        ts: decided ? c.resolvedTs : 0,
      },
      ...(c.status === "rejected"
        ? []
        : [
            { label: "Aprovado", done: c.status === "approved" || c.status === "paid", ts: 0 },
            { label: c.status === "paid" ? `Pago: ${fmtMoney(c.payoutAmount)}` : "Pagamento", done: c.status === "paid", ts: c.status === "paid" ? c.resolvedTs : 0 },
          ]),
    ];
  }, [c, threshold]);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sinistro #{c.id} · {policy ? `${policy.plate}` : shortAddr(c.policy)}
          </p>
          <h3 className="mt-1 font-bold">{KIND_LABEL[c.kind]} · {fmtMoney(c.amountRequested)}</h3>
        </div>
        <ClaimStatusChip status={c.status} />
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{c.description}</p>

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
          Janela de votação: {now > c.votingDeadline ? "encerrada" : `restam ${fmtDuration(c.votingDeadline - now)}`}
        </p>
      )}

      {c.status === "approved" && (
        <button
          className="btn btn-primary mt-4 w-full"
          disabled={!!busy}
          onClick={() => run(`pay-${c.address}`, () => client.payClaim(c.address), "Indenização recebida!")}
        >
          {busy === `pay-${c.address}` && <Spinner />} Receber indenização
        </button>
      )}
      {c.status === "pending" && now > c.votingDeadline && (
        <button
          className="btn btn-ghost mt-4 w-full"
          disabled={!!busy}
          onClick={() => run(`exp-${c.address}`, () => client.expireClaim(c.address), "Sinistro encerrado por falta de quórum")}
        >
          Encerrar (sem quórum)
        </button>
      )}
    </div>
  );
}
