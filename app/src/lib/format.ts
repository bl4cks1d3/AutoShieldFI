import { UNIT } from "./pricing";
import { CLUSTER_LABEL, STABLE_SYMBOL } from "./config";
import { getLang, locale, tr, translateError } from "./i18n";

// Formatadores sensiveis ao idioma escolhido (PT-BR ou English).

function money(): Intl.NumberFormat {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoney(base: number, symbol = true): string {
  const s = money().format(base / UNIT);
  return symbol ? `${s} ${STABLE_SYMBOL}` : s;
}

export function fmtBRL(base: number): string {
  return `R$ ${money().format(base / UNIT)}`;
}

/** Numero no idioma atual, ex.: 1.234,5 (PT) ou 1,234.5 (EN). */
export function fmtNum(v: number, maxDigits = 2): string {
  return v.toLocaleString(locale(), { maximumFractionDigits: maxDigits });
}

/** Numero para preencher um campo de texto (sem separador de milhar). */
export function fmtInput(v: number, digits?: number): string {
  const s = digits === undefined ? String(v) : v.toFixed(digits);
  return getLang() === "en" ? s : s.replace(".", ",");
}

/** Le um valor digitado no idioma atual e converte para unidades base do token. */
export function toBase(v: number | string): number {
  let n: number;
  if (typeof v === "number") n = v;
  else if (getLang() === "en") n = Number(v.replace(/,/g, ""));
  else n = Number(v.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * UNIT);
}

export function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(locale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toLocaleString(locale(), { maximumFractionDigits: digits })}%`;
}

export function shortAddr(a: string): string {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function fmtDuration(secs: number): string {
  if (secs <= 0) return tr("encerrado", "ended");
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${Math.floor(secs % 60)}s`;
}

export function errMsg(e: unknown): string {
  const any = e as {
    error?: { errorMessage?: string };
    message?: string;
    logs?: string[];
  };
  if (any?.error?.errorMessage) return translateError(any.error.errorMessage);
  const msg = any?.message ?? String(e);
  const m = msg.match(/Error Message: ([^.]+)/);
  if (m) return translateError(m[1]);
  if (msg.includes("User rejected")) return translateError("Transação cancelada na carteira");
  // carteira sem SOL nesta rede para pagar a taxa
  if (msg.includes("no record of a prior credit"))
    return tr(
      `Sua carteira não tem SOL na ${CLUSTER_LABEL} para pagar a taxa. Pegue SOL grátis em faucet.solana.com (rede ${CLUSTER_LABEL}) e tente de novo.`,
      `Your wallet has no SOL on ${CLUSTER_LABEL} to pay the fee. Get free SOL at faucet.solana.com (${CLUSTER_LABEL} network) and try again.`,
    );
  if (msg.includes("insufficient funds") || msg.includes("0x1"))
    return translateError("Saldo insuficiente para a operação");
  const out = translateError(msg);
  return out.length > 180 ? out.slice(0, 180) + "…" : out;
}
