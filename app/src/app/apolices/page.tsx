"use client";

import { AlertTriangle, ClipboardCheck, Coins, ExternalLink, FileWarning, Hourglass, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import Link from "next/link";
import { useAction, useApp, useData } from "@/components/Providers";
import { Chip, Empty, Loading, PageHeader, Progress, Row, Spinner, WalletGate } from "@/components/ui";
import { explorerAddr } from "@/lib/config";
import { fmtDate, fmtDuration, fmtMoney, TIER_LABEL } from "@/lib/format";
import { policyPhase } from "@/lib/plate";
import type { PolicyInfo } from "@/lib/types";

export default function ApolicesPage() {
  return (
    <div>
      <PageHeader
        title="Minhas apólices"
        subtitle="Acompanhe vigência, sinistros e resgate seu cashback."
        action={
          <Link href="/cotar" className="btn btn-primary">
            Nova apólice
          </Link>
        }
      />
      <WalletGate>
        <PolicyList />
      </WalletGate>
    </div>
  );
}

function PolicyList() {
  const { client } = useApp();
  const { data, loading } = useData(
    async (c) => ({ policies: await c.getPolicies(c.wallet!), now: await c.now() }),
    [client.wallet],
  );

  if (loading && !data) return <Loading />;
  if (!data?.policies.length)
    return (
      <Empty icon={<ShieldOff className="size-6" />} title="Você ainda não tem apólices">
        <p>Faça uma cotação e proteja seu veículo em poucos cliques.</p>
        <Link href="/cotar" className="btn btn-primary mt-4">
          Fazer cotação
        </Link>
      </Empty>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.policies.map((p) => (
        <PolicyCard key={p.address} p={p} now={data.now} />
      ))}
    </div>
  );
}

function PolicyCard({ p, now }: { p: PolicyInfo; now: number }) {
  const { client } = useApp();
  const { run, busy } = useAction();
  const total = p.endTs - p.startTs;
  const elapsed = Math.min(Math.max(now - p.startTs, 0), total);
  const expired = now > p.endTs;
  const active = p.status === "active";
  const phase = policyPhase(p, now);

  let status: { label: string; tone: "ok" | "warn" | "bad" | "info" | "neutral" };
  if (phase === "cancelled") status = { label: "Recusada na vistoria", tone: "bad" };
  else if (phase === "settled") status = { label: "Encerrada", tone: "neutral" };
  else if (p.hasOpenClaim) status = { label: "Sinistro em andamento", tone: "warn" };
  else if (phase === "expired") status = { label: "Vencida — liquidar", tone: "info" };
  else if (phase === "inspection") status = { label: "Aguardando vistoria", tone: "warn" };
  else if (phase === "waiting") status = { label: "Em carência", tone: "info" };
  else status = { label: "Coberta", tone: "ok" };

  const settle = () =>
    run(
      `settle-${p.address}`,
      () => client.settle(p.address),
      !p.hadPaidClaim && p.cashbackAmount > 0 ? `Cashback de ${fmtMoney(p.cashbackAmount)} recebido!` : "Apólice encerrada",
    );

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Apólice #{p.id} · {TIER_LABEL[p.tier]}
          </p>
          <h3 className="mt-1 text-lg font-bold">{p.model}</h3>
          <p className="text-sm text-[var(--muted)]">
            <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-[var(--fg)]">{p.plate}</span> · {p.year}
          </p>
        </div>
        <Chip tone={status.tone}>{status.label}</Chip>
      </div>

      {active && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{fmtDate(p.startTs)}</span>
            <span>{expired ? "vencida" : `restam ${fmtDuration(p.endTs - now)}`}</span>
          </div>
          <Progress value={total ? elapsed / total : 1} />
        </div>
      )}

      <div className="mt-4 divide-y divide-[var(--border)] text-sm">
        <Row label="Cobertura restante" value={fmtMoney(p.coverageLimit - p.totalPaidOut)} />
        <Row label="Prêmio pago" value={fmtMoney(p.premiumPaid)} />
        <Row label="Franquia" value={fmtMoney(p.deductible)} />
        <Row label="Vigência até" value={fmtDate(p.endTs)} />
        {p.totalPaidOut > 0 && <Row label="Indenizações recebidas" value={fmtMoney(p.totalPaidOut)} />}
        <Row
          label="Cashback"
          value={
            p.cashbackRedeemed ? (
              <span className="text-[var(--ok)]">{fmtMoney(p.cashbackAmount)} resgatado</span>
            ) : p.hadPaidClaim ? (
              <span className="text-[var(--muted)] line-through">{fmtMoney(p.cashbackAmount)}</span>
            ) : (
              <span className="text-[var(--ok)]">{fmtMoney(p.cashbackAmount)}</span>
            )
          }
        />
      </div>

      {phase === "inspection" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <ClipboardCheck className="mt-0.5 size-3.5 shrink-0" /> Um avaliador precisa confirmar o veículo e o valor FIPE.
          Se a vistoria for recusada, o prêmio volta integralmente.
        </p>
      )}
      {phase === "waiting" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <Hourglass className="mt-0.5 size-3.5 shrink-0" /> Vistoria aprovada. Sinistros aceitos a partir de{" "}
          {fmtDate(p.claimsAllowedFrom)} (carência de {fmtDuration(p.claimsAllowedFrom - p.startTs)}).
        </p>
      )}
      {phase === "cancelled" && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
          <Undo2 className="mt-0.5 size-3.5 shrink-0" /> Vistoria recusada: {fmtMoney(p.premiumPaid)} devolvidos e placa
          liberada para nova contratação.
        </p>
      )}

      {p.hadPaidClaim && active && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <AlertTriangle className="size-3.5" /> Sinistro indenizado: o cashback volta para o pool.
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {phase === "covered" && !p.hasOpenClaim && (
          <Link href={`/sinistros?policy=${p.address}`} className="btn btn-ghost">
            <FileWarning className="size-4" /> Acionar sinistro
          </Link>
        )}
        {active && p.hasOpenClaim && (
          <Link href="/sinistros" className="btn btn-ghost">
            <FileWarning className="size-4" /> Acompanhar sinistro
          </Link>
        )}
        {active && expired && !p.hasOpenClaim && (
          <button className="btn btn-primary" disabled={!!busy} onClick={settle}>
            {busy === `settle-${p.address}` ? <Spinner /> : <Coins className="size-4" />}
            {!p.hadPaidClaim && p.cashbackAmount > 0 ? `Resgatar ${fmtMoney(p.cashbackAmount)}` : "Encerrar apólice"}
          </button>
        )}
        {p.status === "settled" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <ShieldCheck className="size-4" /> Ciclo concluído
          </span>
        )}
        {client.mode === "chain" && (
          <a href={explorerAddr(p.address)} target="_blank" rel="noreferrer" className="btn btn-ghost ml-auto !px-3" title="Ver conta on-chain">
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}
