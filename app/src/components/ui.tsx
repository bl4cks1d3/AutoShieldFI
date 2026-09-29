"use client";

import { ExternalLink, Loader2, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { CLUSTER_LABEL, DEMO_ENABLED, ipfsUrl } from "@/lib/config";
import { locale, statusLabel, useI18n } from "@/lib/i18n";
import type { ClaimStatus } from "@/lib/types";
import { useApp } from "./Providers";
import { LoginButton, PRIVY_ENABLED } from "./PrivyAuth";

export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-xl bg-[var(--bg-soft)]" /> },
);

/** Data de hoje por extenso, so no cliente (evita divergencia de fuso/idioma na hidratacao). */
function Today() {
  const { lang } = useI18n();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(new Date().toLocaleDateString(locale(lang), { weekday: "long", day: "numeric", month: "long" }));
  }, [lang]);
  return <>{text || " "}</>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.02em] text-[var(--muted)]">
          <Today />
        </p>
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.025em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
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
  const { lang } = useI18n();
  return <span className={`chip ${STATUS_STYLE[status]}`}>{statusLabel(status, lang)}</span>;
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
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[var(--muted)]">
      <Spinner /> {t("Carregando…", "Loading…")}
    </div>
  );
}

/** Exige carteira conectada no modo on-chain. */
export function WalletGate({ children }: { children: ReactNode }) {
  const { client } = useApp();
  const { t } = useI18n();
  if (client.wallet) return <>{children}</>;
  return (
    <Empty icon={<Wallet className="size-6" />} title={t("Conecte sua carteira", "Connect your wallet")}>
      <p>
        {t("Use Phantom, Solflare ou Backpack na rede", "Use Phantom, Solflare or Backpack on the")} {CLUSTER_LABEL}{" "}
        {t("para continuar.", "network to continue.")}
      </p>
      <div className="mt-4 flex flex-col items-center gap-3">
        <WalletButton />
        {PRIVY_ENABLED && (
          <>
            <span className="text-xs uppercase text-[var(--muted)]">{t("ou", "or")}</span>
            <LoginButton />
          </>
        )}
      </div>
    </Empty>
  );
}

export function PoolMissing() {
  const { t } = useI18n();
  return (
    <Empty icon={<Wallet className="size-6" />} title={t("Pool não encontrado nesta rede", "Pool not found on this network")}>
      <p>
        {t("O programa ainda não foi inicializado neste cluster.", "The program has not been initialized on this cluster yet.")}
        {DEMO_ENABLED ? (
          <>
            {" "}
            {t("Rode", "Run")} <code>anchor run bootstrap</code>{" "}
            {t("(veja o README) ou alterne para o", "(see the README) or switch to")}{" "}
            <b>{t("modo demonstração", "demo mode")}</b> {t("na barra lateral.", "in the sidebar.")}
          </>
        ) : (
          <> {t("Tente novamente em alguns minutos.", "Please try again in a few minutes.")}</>
        )}
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

/** Evidencias de sinistro: link para o IPFS (se enviado) + hash de integridade. */
export function EvidenceLink({ uri }: { uri: string }) {
  const { t } = useI18n();
  const url = ipfsUrl(uri);
  const sha = uri.match(/sha256:([0-9a-f]{8})/)?.[1];
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
          {t("Ver no IPFS", "View on IPFS")} <ExternalLink className="size-3" />
        </a>
      )}
      {sha ? <span className="font-mono text-[var(--muted)]">sha256 {sha}…</span> : !url && <span className="text-[var(--muted)]">{t("sem anexos", "no attachments")}</span>}
    </span>
  );
}
