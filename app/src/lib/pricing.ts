import type { ClaimKind, DeductibleOption, PoolParams, Tier } from "./types";

// Espelho de programs/autoshield/src/pricing.rs — manter sincronizado.

export const TOKEN_DECIMALS = 6;
export const UNIT = 10 ** TOKEN_DECIMALS;
/** Franquia padrao (opcao "normal"). */
export const DEDUCTIBLE_BPS = 500;
/** Perda total: dano a partir de 75% do valor coberto. */
export const TOTAL_LOSS_BPS = 7_500;
/** Arrependimento (CDC art. 49). */
export const COOLING_OFF_DAYS = 7;
export const FIPE_PCT_OPTIONS = [90, 100, 110] as const;

export const DEDUCTIBLE_BPS_BY_OPTION: Record<DeductibleOption, number> = {
  reduced: 250,
  normal: 500,
  increased: 1_000,
};

/** Ajuste do premio (%) pela franquia escolhida. */
export const DEDUCTIBLE_PRICE_PCT: Record<DeductibleOption, number> = {
  reduced: 115,
  normal: 100,
  increased: 85,
};
export const MIN_DAYS = 30;
export const MAX_DAYS = 365;
export const FAUCET_MAX = 200_000 * UNIT;

export const TIER_MULTIPLIER: Record<Tier, number> = {
  basic: 60,
  standard: 100,
  premium: 140,
  theftOnly: 35,
};

export const TIER_COVERS: Record<Tier, ClaimKind[]> = {
  basic: ["theft", "naturalEvent"],
  standard: ["theft", "naturalEvent", "collision"],
  premium: ["theft", "naturalEvent", "collision", "thirdParty", "other"],
  theftOnly: ["theft"],
};

export interface Quote {
  premium: number;
  coverageLimit: number;
  deductible: number;
  cashback: number;
  netCost: number;
  monthlyEquivalent: number;
}

/** Valor coberto: percentual escolhido da FIPE. */
export function coverageFor(vehicleValue: number, fipePct: number): number {
  return Number((BigInt(Math.floor(vehicleValue)) * BigInt(fipePct)) / 100n);
}

export function quote(
  params: Pick<PoolParams, "baseRateBps" | "cashbackBps">,
  vehicleValue: number,
  tier: Tier,
  durationDays: number,
  fipePct = 100,
  deductibleOption: DeductibleOption = "normal",
): Quote {
  const coverage = coverageFor(vehicleValue, fipePct);
  const c = BigInt(coverage);
  const premium = Number(
    (c *
      BigInt(params.baseRateBps) *
      BigInt(TIER_MULTIPLIER[tier]) *
      BigInt(DEDUCTIBLE_PRICE_PCT[deductibleOption]) *
      BigInt(durationDays)) /
      BigInt(10_000 * 100 * 100 * 365),
  );
  const deductible = Number((c * BigInt(DEDUCTIBLE_BPS_BY_OPTION[deductibleOption])) / 10_000n);
  const cashback = Number((BigInt(premium) * BigInt(params.cashbackBps)) / 10_000n);
  return {
    premium,
    coverageLimit: coverage,
    deductible,
    cashback,
    netCost: premium - cashback,
    monthlyEquivalent: Math.round((premium / durationDays) * 30),
  };
}

/** Roubo/furto, ou dano a partir de 75% do valor coberto (espelha Policy::is_total_loss). */
export function isTotalLoss(kind: ClaimKind, amount: number, coverageLimit: number): boolean {
  return kind === "theft" || amount * 10_000 >= coverageLimit * TOTAL_LOSS_BPS;
}

/** Indenizacao esperada para um sinistro (espelha pay_claim). */
export function expectedPayout(
  kind: ClaimKind,
  amount: number,
  deductible: number,
  remainingCoverage: number,
  coverageLimit: number,
): { payout: number; totalLoss: boolean } {
  if (isTotalLoss(kind, amount, coverageLimit)) return { payout: remainingCoverage, totalLoss: true };
  return { payout: Math.max(0, Math.min(amount - deductible, remainingCoverage)), totalLoss: false };
}

/** Devolucao ao cancelar (espelha cancel_policy). */
export function cancellationRefund(
  p: {
    startTs: number;
    endTs: number;
    premiumPaid: number;
    premiumTotal: number;
    inspectionFee: number;
    claimsFiled: number;
    hadPaidClaim: boolean;
  },
  now: number,
  params: Pick<PoolParams, "secondsPerDay" | "protocolFeeBps">,
): { refund: number; coolingOff: boolean; coolingOffEnd: number } {
  const coolingOffEnd = p.startTs + COOLING_OFF_DAYS * params.secondsPerDay;
  const coolingOff = now <= coolingOffEnd && p.claimsFiled === 0;
  if (coolingOff) return { refund: p.premiumPaid + p.inspectionFee, coolingOff, coolingOffEnd };
  if (p.hadPaidClaim) return { refund: 0, coolingOff, coolingOffEnd };
  const duration = Math.max(1, p.endTs - p.startTs);
  const elapsed = Math.min(Math.max(now, p.startTs), p.endTs) - p.startTs;
  const earned = Math.floor((p.premiumTotal * elapsed) / duration);
  const unused = Math.max(0, p.premiumPaid - earned);
  return { refund: Math.floor((unused * (10_000 - params.protocolFeeBps)) / 10_000), coolingOff, coolingOffEnd };
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
