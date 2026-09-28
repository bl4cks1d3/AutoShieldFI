import type { ClaimKind, PoolParams, Tier } from "./types";

// Espelho de programs/autoshield/src/pricing.rs — manter sincronizado.

export const TOKEN_DECIMALS = 6;
export const UNIT = 10 ** TOKEN_DECIMALS;
export const DEDUCTIBLE_BPS = 500;
export const MIN_DAYS = 30;
export const MAX_DAYS = 365;
export const FAUCET_MAX = 200_000 * UNIT;

export const TIER_MULTIPLIER: Record<Tier, number> = {
  basic: 60,
  standard: 100,
  premium: 140,
};

export const TIER_COVERS: Record<Tier, ClaimKind[]> = {
  basic: ["theft", "naturalEvent"],
  standard: ["theft", "naturalEvent", "collision"],
  premium: ["theft", "naturalEvent", "collision", "thirdParty", "other"],
};

export interface Quote {
  premium: number;
  coverageLimit: number;
  deductible: number;
  cashback: number;
  netCost: number;
  monthlyEquivalent: number;
}

export function quote(
  params: Pick<PoolParams, "baseRateBps" | "cashbackBps">,
  vehicleValue: number,
  tier: Tier,
  durationDays: number,
): Quote {
  const v = BigInt(Math.floor(vehicleValue));
  const premium = Number(
    (v * BigInt(params.baseRateBps) * BigInt(TIER_MULTIPLIER[tier]) * BigInt(durationDays)) /
      BigInt(10_000 * 100 * 365),
  );
  const deductible = Number((v * BigInt(DEDUCTIBLE_BPS)) / 10_000n);
  const cashback = Number((BigInt(premium) * BigInt(params.cashbackBps)) / 10_000n);
  return {
    premium,
    coverageLimit: vehicleValue,
    deductible,
    cashback,
    netCost: premium - cashback,
    monthlyEquivalent: Math.round((premium / durationDays) * 30),
  };
}

/** Indenizacao esperada para um sinistro (espelha pay_claim). */
export function expectedPayout(
  kind: ClaimKind,
  amount: number,
  deductible: number,
  remainingCoverage: number,
): number {
  const d = kind === "theft" || kind === "naturalEvent" ? 0 : deductible;
  return Math.max(0, Math.min(amount - d, remainingCoverage));
}
