import { sha256 } from "@noble/hashes/sha256";
import { paidUntil } from "./pricing";

// Espelho de normalize_plate (programs/autoshield/src/state.rs).
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** sha256 da placa normalizada: semente do registro unico do veiculo. */
export function plateHash(plate: string): number[] {
  return Array.from(sha256(new TextEncoder().encode(normalizePlate(plate))));
}

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function plateHashHex(plate: string): string {
  return toHex(plateHash(plate));
}

// A placa em texto nunca vai para a blockchain (LGPD). Quem a digita guarda uma
// copia so no proprio navegador para exibicao; nos demais, o app mostra o hash.
const BOOK_KEY = "autoshield-plates";

function readBook(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(BOOK_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberPlate(plate: string) {
  try {
    const book = readBook();
    book[plateHashHex(plate)] = normalizePlate(plate);
    window.localStorage.setItem(BOOK_KEY, JSON.stringify(book));
  } catch {
    /* ignora */
  }
}

/** Placa conhecida neste navegador para o hash, ou "" se desconhecida. */
export function lookupPlate(hashHex: string): string {
  if (typeof window === "undefined") return "";
  return readBook()[hashHex] ?? "";
}

/** Texto de exibicao: a placa, se conhecida, ou o inicio do hash. */
export function displayPlate(p: { plate?: string; plateHash: string }): string {
  return p.plate || lookupPlate(p.plateHash) || `#${p.plateHash.slice(0, 8)}`;
}

export type PolicyPhase =
  | "inspection"
  | "waiting"
  | "covered"
  | "overdue"
  | "lapsed"
  | "expired"
  | "settled"
  | "cancelled";

interface PhaseInput {
  status: string;
  inspected: boolean;
  claimsAllowedFrom: number;
  startTs: number;
  endTs: number;
  installments: number;
  installmentsPaid: number;
  installmentPeriod: number;
}

/** Fase da apolice do ponto de vista do motorista. */
export function policyPhase(p: PhaseInput, now: number, graceSecs = 0): PolicyPhase {
  if (p.status === "cancelled" || p.status === "cancelledByOwner") return "cancelled";
  if (p.status === "settled") return "settled";
  if (now > p.endTs) return "expired";
  const paid = paidUntil(p);
  if (p.installmentsPaid < p.installments && now > paid + graceSecs) return "lapsed";
  if (p.installmentsPaid < p.installments && now > paid) return "overdue";
  if (!p.inspected) return "inspection";
  if (now < p.claimsAllowedFrom) return "waiting";
  return "covered";
}
