import { sha256 } from "@noble/hashes/sha256";

// Espelho de normalize_plate (programs/autoshield/src/state.rs).
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** sha256 da placa normalizada: semente do registro unico do veiculo. */
export function plateHash(plate: string): number[] {
  return Array.from(sha256(new TextEncoder().encode(normalizePlate(plate))));
}

export type PolicyPhase = "inspection" | "waiting" | "covered" | "expired" | "settled" | "cancelled";

/** Fase da apolice do ponto de vista do motorista. */
export function policyPhase(
  p: { status: string; inspected: boolean; claimsAllowedFrom: number; endTs: number },
  now: number,
): PolicyPhase {
  if (p.status === "cancelled") return "cancelled";
  if (p.status === "settled") return "settled";
  if (now > p.endTs) return "expired";
  if (!p.inspected) return "inspection";
  if (now < p.claimsAllowedFrom) return "waiting";
  return "covered";
}
