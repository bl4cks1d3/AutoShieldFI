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
  if (p.status === "cancelled") return "cancelled";
  if (p.status === "settled") return "settled";
  if (now > p.endTs) return "expired";
  const paid = paidUntil(p);
  if (p.installmentsPaid < p.installments && now > paid + graceSecs) return "lapsed";
  if (p.installmentsPaid < p.installments && now > paid) return "overdue";
  if (!p.inspected) return "inspection";
  if (now < p.claimsAllowedFrom) return "waiting";
  return "covered";
}
