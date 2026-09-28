"use client";

import { Loader2, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { CLUSTER_LABEL } from "@/lib/config";
import { STATUS_LABEL } from "@/lib/format";
import type { ClaimStatus } from "@/lib/types";
import { useApp } from "./Providers";

export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-xl bg-[var(--bg-soft)]" /> },
);

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="num mt-1 text-xl font-bold sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<ClaimStatus, string> = {
  pending: "bg-[var(--warn-soft)] text-[var(--warn)]",
  approved: "bg-[var(--info-soft)] text-[var(--info)]",
  rejected: "bg-[var(--bad-soft)] text-[var(--bad)]",
  paid: "bg-[var(--ok-soft)] text-[var(--ok)]",
};

export function ClaimStatusChip({ status }: { status: ClaimStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" }) {
  const cls = {
    neutral: "bg-[var(--bg-soft)] text-[var(--muted)]",
    ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
    bad: "bg-[var(--bad-soft)] text-[var(--bad)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  }[tone];
  return <span className={`chip ${cls}`}>{children}</span>;
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "warn" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-soft)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: tone === "warn" ? "var(--warn)" : "var(--accent)" }}
      />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">{icon}</div>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-[var(--muted)]">{children}</div>}
    </div>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[var(--muted)]">
      <Spinner /> Carregando…
    </div>
  );
}

/** Exige carteira conectada no modo on-chain. */
export function WalletGate({ children }: { children: ReactNode }) {
  const { client } = useApp();
  if (client.wallet) return <>{children}</>;
  return (
    <Empty icon={<Wallet className="size-6" />} title="Conecte sua carteira">
      <p>Use Phantom, Solflare ou Backpack na rede {CLUSTER_LABEL} para continuar.</p>
      <div className="mt-4 flex justify-center">
        <WalletButton />
      </div>
    </Empty>
  );
}

export function PoolMissing() {
  return (
    <Empty icon={<Wallet className="size-6" />} title="Pool não encontrado nesta rede">
      <p>
        O programa ainda não foi inicializado neste cluster. Rode <code>yarn bootstrap</code> (veja o README) ou
        alterne para o <b>modo demonstração</b> no topo da página.
      </p>
    </Empty>
  );
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-[var(--muted)]"}>{label}</span>
      <span className="num text-right">{value}</span>
    </div>
  );
}
