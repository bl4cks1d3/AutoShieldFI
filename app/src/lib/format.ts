import { UNIT } from "./pricing";
import type { ClaimKind, ClaimStatus, Tier } from "./types";
import { STABLE_SYMBOL } from "./config";

const brl = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(base: number, symbol = true): string {
  const s = brl.format(base / UNIT);
  return symbol ? `${s} ${STABLE_SYMBOL}` : s;
}

export function fmtBRL(base: number): string {
  return `R$ ${brl.format(base / UNIT)}`;
}

export function toBase(v: number | string): number {
  const n = typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : v;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * UNIT);
}

export function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

export function shortAddr(a: string): string {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function fmtDuration(secs: number): string {
  if (secs <= 0) return "encerrado";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${Math.floor(secs % 60)}s`;
}

export const TIER_LABEL: Record<Tier, string> = {
  basic: "Básico",
  standard: "Essencial",
  premium: "Completo",
};

export const TIER_DESC: Record<Tier, string> = {
  basic: "Roubo, furto e eventos da natureza",
  standard: "Básico + colisão",
  premium: "Essencial + danos a terceiros e outros eventos",
};

export const KIND_LABEL: Record<ClaimKind, string> = {
  theft: "Roubo / furto",
  collision: "Colisão",
  thirdParty: "Danos a terceiros",
  naturalEvent: "Evento da natureza",
  other: "Outros",
};

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  paid: "Pago",
};

export function errMsg(e: unknown): string {
  const any = e as {
    error?: { errorMessage?: string };
    message?: string;
    logs?: string[];
  };
  if (any?.error?.errorMessage) return any.error.errorMessage;
  const msg = any?.message ?? String(e);
  const m = msg.match(/Error Message: ([^.]+)/);
  if (m) return m[1];
  if (msg.includes("User rejected")) return "Transação cancelada na carteira";
  if (msg.includes("insufficient funds") || msg.includes("0x1"))
    return "Saldo insuficiente para a operação";
  return msg.length > 180 ? msg.slice(0, 180) + "…" : msg;
}
