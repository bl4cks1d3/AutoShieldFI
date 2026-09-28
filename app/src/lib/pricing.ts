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

// ---------- parcelamento e taxas (espelho de instructions/policy.rs) ----------

export const MAX_INSTALLMENTS = 12;
export const MIN_DAYS_PER_INSTALLMENT = 30;
export const DEAD_SHARES = 1_000_000;
export const MIN_FIRST_DEPOSIT = 100 * UNIT;

/** Opcoes de parcelamento validas para a vigencia (cada parcela >= 30 dias). */
export function installmentOptions(durationDays: number): number[] {
  const max = Math.min(MAX_INSTALLMENTS, Math.floor(durationDays / MIN_DAYS_PER_INSTALLMENT));
  return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
}

/** Valor da parcela `number` (1-based); a ultima absorve o resto da divisao. */
export function installmentAmount(premiumTotal: number, installments: number, number: number): number {
  if (installments <= 1) return premiumTotal;
  const base = Math.floor(premiumTotal / installments);
  return number === installments ? premiumTotal - base * (installments - 1) : base;
}

/** Divide um pagamento em taxa do protocolo, cashback reservado e parte dos LPs. */
export function splitPayment(
  params: Pick<PoolParams, "protocolFeeBps" | "cashbackBps">,
  amount: number,
  cashbackEnabled = true,
) {
  const fee = Math.floor((amount * params.protocolFeeBps) / 10_000);
  const cashback = cashbackEnabled ? Math.floor((amount * params.cashbackBps) / 10_000) : 0;
  return { fee, cashback, toPool: amount - fee - cashback };
}

/** Instante ate o qual a cobertura esta paga. */
export function paidUntil(p: {
  installments: number;
  installmentsPaid: number;
  installmentPeriod: number;
  startTs: number;
  endTs: number;
}): number {
  if (p.installmentsPaid >= p.installments) return p.endTs;
  return p.startTs + p.installmentPeriod * p.installmentsPaid;
}

export function isLapsed(
  p: Parameters<typeof paidUntil>[0],
  now: number,
  grace: number,
): boolean {
  return p.installmentsPaid < p.installments && now > paidUntil(p) + grace;
}
