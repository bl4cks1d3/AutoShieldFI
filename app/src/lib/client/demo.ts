import type {
  AutoShieldClient,
  ClaimInfo,
  ClaimInput,
  PolicyInfo,
  PoolInfo,
  PoolParams,
  PurchaseInput,
  StakeInfo,
} from "../types";
import { normalizePlate } from "../plate";
import {
  DEAD_SHARES,
  FAUCET_MAX,
  MAX_DAYS,
  MAX_INSTALLMENTS,
  MIN_DAYS,
  MIN_DAYS_PER_INSTALLMENT,
  MIN_FIRST_DEPOSIT,
  TIER_COVERS,
  UNIT,
  expectedPayout,
  installmentAmount,
  isLapsed,
  paidUntil,
  quote,
  splitPayment,
} from "../pricing";

// Simulacao local (localStorage) que replica as regras do programa on-chain.
// Permite demonstrar o fluxo completo sem carteira, SOL ou deploy.

const KEY = "autoshield-demo-v3";
export const DEMO_WALLET = "DemoMotorista1111111111111111111111111111111";
export const DEMO_ASSESSORS = [
  "Avaliador1Demo11111111111111111111111111111",
  "Avaliador2Demo11111111111111111111111111111",
  "Avaliador3Demo11111111111111111111111111111",
];

interface DemoState {
  timeOffset: number;
  txCount: number;
  pool: PoolInfo;
  balances: Record<string, number>;
  policies: PolicyInfo[];
  claims: ClaimInfo[];
  stakes: Record<string, StakeInfo>;
  /** Registro unico por veiculo: placa normalizada -> apolice vistoriada e ativa. */
  vehicles: Record<string, string>;
}

const DEFAULT_PARAMS: PoolParams = {
  baseRateBps: 350,
  cashbackBps: 2000,
  protocolFeeBps: 500,
  minCollateralBps: 1000,
  withdrawCooldownSecs: 7 * 86400,
  claimVotingSecs: 3 * 86400,
  secondsPerDay: 86400,
  claimWaitingSecs: 7 * 86400,
  installmentGraceSecs: 5 * 86400,
  governanceDelaySecs: 86400,
  inspectionFee: 50 * UNIT,
  voteReward: 10 * UNIT,
  minVehicleValue: 5_000 * UNIT,
  faucetEnabled: true,
};

function initialState(): DemoState {
  // Liquidez inicial de LPs simulados (as cotas nao pertencem ao usuario).
  const seedLiquidity = 750_000 * UNIT;
  return {
    timeOffset: 0,
    txCount: 0,
    pool: {
      address: "PoolDemo111111111111111111111111111111111111",
      authority: DEMO_WALLET,
      stableMint: "tBRLDemo11111111111111111111111111111111111",
      vault: "VaultDemo1111111111111111111111111111111111",
      vaultBalance: seedLiquidity,
      totalShares: seedLiquidity,
      totalActiveCoverage: 0,
      reservedCashback: 0,
      pendingClaims: 0,
      totalPremiums: 0,
      totalClaimsPaid: 0,
      totalCashbackPaid: 0,
      policyCount: 0,
      claimCount: 0,
      activePolicies: 0,
      params: { ...DEFAULT_PARAMS },
      assessors: DEMO_ASSESSORS,
      approvalThreshold: 2,
      paused: false,
      treasuryAccrued: 0,
      pendingInspectionFees: 0,
      totalProtocolFees: 0,
      totalAssessorRewards: 0,
      pendingParams: null,
      pendingParamsEta: 0,
      pendingAssessors: [],
      pendingThreshold: 0,
      pendingAssessorsEta: 0,
      pendingAuthority: null,
    },
    balances: {},
    policies: [],
    claims: [],
    stakes: {},
    vehicles: {},
  };
}

function load(): DemoState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* ignora */
  }
  return initialState();
}

function save(s: DemoState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignora */
  }
}

export function resetDemo() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

/** Avanca o relogio da simulacao (para demonstrar vencimentos). */
export function advanceDemoTime(seconds: number) {
  const s = load();
  s.timeOffset += seconds;
  save(s);
}

const delay = () => new Promise((r) => setTimeout(r, 350));

function fail(msg: string): never {
  throw new Error(`Error Message: ${msg}.`);
}

function validParams(p: PoolParams) {
  return (
    p.baseRateBps > 0 &&
    p.baseRateBps <= 5_000 &&
    p.cashbackBps <= 5_000 &&
    p.protocolFeeBps <= 3_000 &&
    p.cashbackBps + p.protocolFeeBps < 10_000 &&
    p.minCollateralBps > 0 &&
    p.minCollateralBps <= 10_000 &&
    p.withdrawCooldownSecs >= 0 &&
    p.claimVotingSecs > 0 &&
    p.secondsPerDay > 0 &&
    p.secondsPerDay <= 86_400 &&
    p.claimWaitingSecs >= 0 &&
    p.installmentGraceSecs >= 0 &&
    p.governanceDelaySecs >= 0 &&
    p.minVehicleValue > 0
  );
}

export class DemoClient implements AutoShieldClient {
  readonly mode = "demo" as const;
  readonly wallet = DEMO_WALLET;
  readonly assessorIdentities = DEMO_ASSESSORS;

  private clock(s: DemoState) {
    return Math.floor(Date.now() / 1000) + s.timeOffset;
  }

  private tx(s: DemoState): string {
    s.txCount += 1;
    save(s);
    return `demo-tx-${s.txCount}`;
  }

  private liabilities(s: DemoState) {
    return s.pool.reservedCashback + s.pool.treasuryAccrued + s.pool.pendingInspectionFees;
  }

  private nav(s: DemoState) {
    return Math.max(0, s.pool.vaultBalance - this.liabilities(s));
  }

  private required(s: DemoState, coverage: number) {
    return Math.floor((coverage * s.pool.params.minCollateralBps) / 10_000) + s.pool.pendingClaims;
  }

  private debit(s: DemoState, who: string, amount: number) {
    const bal = s.balances[who] ?? 0;
    if (bal < amount) fail("Saldo insuficiente para a operação");
    s.balances[who] = bal - amount;
  }

  private credit(s: DemoState, who: string, amount: number) {
    s.balances[who] = (s.balances[who] ?? 0) + amount;
  }

  /** Mesma contabilidade de account_payment no contrato. */
  private accountPayment(s: DemoState, p: PolicyInfo, amount: number) {
    const { fee, cashback } = splitPayment(s.pool.params, amount, !p.hadPaidClaim);
    s.pool.treasuryAccrued += fee;
    s.pool.totalProtocolFees += fee;
    s.pool.reservedCashback += cashback;
    s.pool.totalPremiums += amount;
    p.protocolFeesPaid += fee;
    p.cashbackAmount += cashback;
    p.premiumPaid += amount;
    p.installmentsPaid += 1;
  }

  async now() {
    return this.clock(load());
  }

  async getPool() {
    return load().pool;
  }

  async getBalance(owner: string) {
    return load().balances[owner] ?? 0;
  }

  async getPolicies(owner?: string) {
    const s = load();
    return s.policies.filter((p) => !owner || p.owner === owner).sort((a, b) => b.startTs - a.startTs);
  }

  async getClaims(owner?: string) {
    const s = load();
    return s.claims.filter((c) => !owner || c.claimant === owner).sort((a, b) => b.createdTs - a.createdTs);
  }

  async getStake(owner: string) {
    return load().stakes[owner] ?? null;
  }

  async faucet(amount: number) {
    await delay();
    if (amount <= 0) fail("Quantidade deve ser maior que zero");
    if (amount > FAUCET_MAX) fail("Valor acima do limite do faucet");
    const s = load();
    this.credit(s, this.wallet, amount);
    return this.tx(s);
  }

  async deposit(amount: number) {
    await delay();
    const s = load();
    if (s.pool.paused) fail("O protocolo está pausado");
    if (amount <= 0) fail("Quantidade deve ser maior que zero");
    const first = s.pool.totalShares === 0;
    let shares: number;
    if (first) {
      if (amount < MIN_FIRST_DEPOSIT) fail("Primeiro aporte abaixo do mínimo");
      shares = amount - DEAD_SHARES;
    } else {
      const nav = this.nav(s);
      if (nav <= 0) fail("Liquidez insuficiente no pool para garantir a cobertura");
      shares = Math.floor((amount * s.pool.totalShares) / nav);
    }
    if (shares <= 0) fail("Quantidade deve ser maior que zero");
    this.debit(s, this.wallet, amount);
    s.pool.vaultBalance += amount;
    s.pool.totalShares += first ? amount : shares;
    const pos = s.stakes[this.wallet] ?? { shares: 0, totalDeposited: 0, totalWithdrawn: 0, lastDepositTs: 0 };
    pos.shares += shares;
    pos.totalDeposited += amount;
    pos.lastDepositTs = this.clock(s);
    s.stakes[this.wallet] = pos;
    return this.tx(s);
  }

  async withdraw(shares: number) {
    await delay();
    const s = load();
    const pos = s.stakes[this.wallet];
    if (!pos || pos.shares < shares || shares <= 0) fail("Saldo de cotas insuficiente");
    if (this.clock(s) < pos.lastDepositTs + s.pool.params.withdrawCooldownSecs)
      fail("Período de carência de saque ainda não terminou");
    const nav = this.nav(s);
    const amount = Math.floor((shares * nav) / s.pool.totalShares);
    if (amount <= 0) fail("Quantidade deve ser maior que zero");
    if (nav - amount < this.required(s, s.pool.totalActiveCoverage))
      fail("Saque deixaria o pool abaixo do colateral mínimo");
    s.pool.vaultBalance -= amount;
    s.pool.totalShares -= shares;
    pos.shares -= shares;
    pos.totalWithdrawn += amount;
    this.credit(s, this.wallet, amount);
    return this.tx(s);
  }

  async purchase(input: PurchaseInput) {
    await delay();
    const s = load();
    const params = s.pool.params;
    if (s.pool.paused) fail("O protocolo está pausado");
    if (input.durationDays < MIN_DAYS || input.durationDays > MAX_DAYS)
      fail("Duração da apólice fora do intervalo permitido (30 a 365 dias)");
    const n = input.installments;
    if (n < 1 || n > MAX_INSTALLMENTS || input.durationDays < MIN_DAYS_PER_INSTALLMENT * n)
      fail("Número de parcelas inválido para a vigência escolhida");
    if (input.vehicleValue < params.minVehicleValue) fail("Valor do veículo inválido");
    const plate = normalizePlate(input.plate);
    if (!plate || plate.length > 10) fail("Placa inválida");
    if (s.vehicles[plate]) fail("Este veículo já possui uma apólice ativa");
    const q = quote(params, input.vehicleValue, input.tier, input.durationDays);
    if (q.premium < n) fail("Valor do veículo inválido");
    if (q.premium > input.maxPremium) fail("Prêmio acima do máximo aceito");
    const first = installmentAmount(q.premium, n, 1);
    const { fee, cashback } = splitPayment(params, first);
    const coverageAfter = s.pool.totalActiveCoverage + q.coverageLimit;
    if (this.nav(s) + first - fee - cashback < this.required(s, coverageAfter))
      fail("Liquidez insuficiente no pool para garantir a cobertura");
    this.debit(s, this.wallet, first + params.inspectionFee);
    s.pool.vaultBalance += first + params.inspectionFee;

    const now = this.clock(s);
    const id = s.pool.policyCount;
    const durationSecs = input.durationDays * params.secondsPerDay;
    const policy: PolicyInfo = {
      address: `PolicyDemo${String(id).padStart(4, "0")}${Math.random().toString(36).slice(2, 10)}`,
      owner: this.wallet,
      id,
      nonce: String(Date.now()),
      plate,
      model: input.model,
      year: input.year,
      vehicleValue: input.vehicleValue,
      tier: input.tier,
      durationDays: input.durationDays,
      premiumTotal: q.premium,
      premiumPaid: 0,
      installments: n,
      installmentsPaid: 0,
      installmentPeriod: Math.floor(durationSecs / n),
      coverageLimit: q.coverageLimit,
      deductible: q.deductible,
      cashbackAmount: 0,
      protocolFeesPaid: 0,
      inspectionFee: params.inspectionFee,
      startTs: now,
      endTs: now + durationSecs,
      status: "active",
      claimsFiled: 0,
      hasOpenClaim: false,
      hadPaidClaim: false,
      totalPaidOut: 0,
      cashbackRedeemed: false,
      inspected: false,
      inspector: "",
      claimsAllowedFrom: now + params.claimWaitingSecs,
    };
    this.accountPayment(s, policy, first);
    s.policies.push(policy);
    s.pool.pendingInspectionFees += params.inspectionFee;
    s.pool.totalActiveCoverage = coverageAfter;
    s.pool.policyCount += 1;
    s.pool.activePolicies += 1;
    return this.tx(s);
  }

  async payInstallment(policyAddr: string) {
    await delay();
    const s = load();
    const p = s.policies.find((x) => x.address === policyAddr);
    if (!p || p.owner !== this.wallet) fail("Operação não autorizada");
    if (p.status !== "active") fail("A apólice não está ativa");
    if (p.installmentsPaid >= p.installments) fail("Todas as parcelas desta apólice já foram pagas");
    if (isLapsed(p, this.clock(s), s.pool.params.installmentGraceSecs))
      fail("Apólice caducada por parcela em atraso");
    const amount = installmentAmount(p.premiumTotal, p.installments, p.installmentsPaid + 1);
    this.debit(s, this.wallet, amount);
    s.pool.vaultBalance += amount;
    this.accountPayment(s, p, amount);
    return this.tx(s);
  }

  async fileClaim(policyAddr: string, input: ClaimInput) {
    await delay();
    const s = load();
    const p = s.policies.find((x) => x.address === policyAddr);
    if (!p || p.owner !== this.wallet) fail("Operação não autorizada");
    const now = this.clock(s);
    if (p.status !== "active") fail("A apólice não está ativa");
    if (now < p.startTs || now > p.endTs) fail("A apólice está fora do período de vigência");
    if (!p.inspected) fail("A apólice ainda não passou pela vistoria");
    if (now < p.claimsAllowedFrom) fail("Sinistro dentro do período de carência da apólice");
    if (now > paidUntil(p)) fail("Apólice caducada por parcela em atraso");
    if (p.hasOpenClaim) fail("Já existe um sinistro em aberto para esta apólice");
    if (!TIER_COVERS[p.tier].includes(input.kind)) fail("O plano contratado não cobre este tipo de sinistro");
    if (input.amount <= 0) fail("Quantidade deve ser maior que zero");
    if (input.amount > p.coverageLimit - p.totalPaidOut)
      fail("Valor solicitado excede o limite de cobertura restante");
    const id = s.pool.claimCount;
    s.claims.push({
      address: `ClaimDemo${String(id).padStart(4, "0")}${Math.random().toString(36).slice(2, 10)}`,
      policy: p.address,
      claimant: p.owner,
      id,
      index: p.claimsFiled,
      kind: input.kind,
      amountRequested: input.amount,
      payoutAmount: 0,
      description: input.description,
      evidenceUri: input.evidenceUri,
      status: "pending",
      approvals: 0,
      rejections: 0,
      voters: [],
      createdTs: now,
      votingDeadline: now + s.pool.params.claimVotingSecs,
      resolvedTs: 0,
    });
    p.claimsFiled += 1;
    p.hasOpenClaim = true;
    s.pool.claimCount += 1;
    s.pool.pendingClaims += input.amount;
    return this.tx(s);
  }

  async vote(claimAddr: string, approve: boolean, as?: string) {
    await delay();
    const s = load();
    const voter = as ?? DEMO_ASSESSORS[0];
    if (!s.pool.assessors.includes(voter)) fail("Assinante não é um avaliador do pool");
    const c = s.claims.find((x) => x.address === claimAddr);
    if (!c) fail("Sinistro não encontrado");
    if (c.claimant === voter) fail("Avaliador não pode votar ou vistoriar a própria apólice");
    if (c.status !== "pending") fail("O sinistro não está pendente");
    const now = this.clock(s);
    if (now > c.votingDeadline) fail("Período de votação encerrado");
    if (c.voters.includes(voter)) fail("Avaliador já votou neste sinistro");
    c.voters.push(voter);
    if (approve) c.approvals += 1;
    else c.rejections += 1;
    const maxRej = s.pool.assessors.length - s.pool.approvalThreshold;
    if (c.approvals >= s.pool.approvalThreshold) {
      c.status = "approved";
      c.resolvedTs = now;
    } else if (c.rejections > maxRej) {
      c.status = "rejected";
      c.resolvedTs = now;
      s.pool.pendingClaims -= c.amountRequested;
      const p = s.policies.find((x) => x.address === c.policy);
      if (p) p.hasOpenClaim = false;
    }
    // remuneracao pelo voto, limitada a tesouraria
    const reward = Math.min(s.pool.params.voteReward, s.pool.treasuryAccrued);
    if (reward > 0) {
      s.pool.vaultBalance -= reward;
      s.pool.treasuryAccrued -= reward;
      s.pool.totalAssessorRewards += reward;
      this.credit(s, voter, reward);
    }
    return this.tx(s);
  }

  async inspect(policyAddr: string, approve: boolean, as?: string) {
    await delay();
    const s = load();
    const inspector = as ?? DEMO_ASSESSORS[0];
    if (!s.pool.assessors.includes(inspector)) fail("Assinante não é um avaliador do pool");
    const p = s.policies.find((x) => x.address === policyAddr);
    if (!p || p.status !== "active") fail("A apólice não está ativa");
    if (p.owner === inspector) fail("Avaliador não pode votar ou vistoriar a própria apólice");
    if (p.inspected) fail("A vistoria desta apólice já foi realizada");
    if (p.hasOpenClaim) fail("Já existe um sinistro em aberto para esta apólice");
    if (approve && s.vehicles[p.plate]) fail("Este veículo já possui uma apólice ativa");
    // a taxa de vistoria vai para o avaliador em qualquer resultado
    s.pool.vaultBalance -= p.inspectionFee;
    s.pool.pendingInspectionFees -= p.inspectionFee;
    s.pool.totalAssessorRewards += p.inspectionFee;
    this.credit(s, inspector, p.inspectionFee);
    p.inspector = inspector;
    if (approve) {
      p.inspected = true;
      s.vehicles[p.plate] = p.address;
    } else {
      // recusada: devolve o premio pago e estorna a contabilidade
      s.pool.vaultBalance -= p.premiumPaid;
      this.credit(s, p.owner, p.premiumPaid);
      s.pool.totalActiveCoverage -= p.coverageLimit - p.totalPaidOut;
      s.pool.reservedCashback -= p.cashbackAmount;
      s.pool.treasuryAccrued -= p.protocolFeesPaid;
      s.pool.totalProtocolFees -= p.protocolFeesPaid;
      s.pool.totalPremiums -= p.premiumPaid;
      s.pool.activePolicies -= 1;
      p.cashbackAmount = 0;
      p.status = "cancelled";
    }
    return this.tx(s);
  }

  async payClaim(claimAddr: string) {
    await delay();
    const s = load();
    const c = s.claims.find((x) => x.address === claimAddr);
    if (!c || c.status !== "approved") fail("O sinistro não está aprovado");
    const p = s.policies.find((x) => x.address === c.policy)!;
    const payout = expectedPayout(c.kind, c.amountRequested, p.deductible, p.coverageLimit - p.totalPaidOut);
    if (payout > this.nav(s)) fail("Liquidez livre insuficiente para pagar o sinistro agora");
    s.pool.vaultBalance -= payout;
    this.credit(s, c.claimant, payout);
    s.pool.pendingClaims -= c.amountRequested;
    s.pool.totalActiveCoverage -= payout;
    s.pool.totalClaimsPaid += payout;
    if (payout > 0 && !p.hadPaidClaim) {
      s.pool.reservedCashback -= p.cashbackAmount;
      p.cashbackAmount = 0;
    }
    p.hasOpenClaim = false;
    p.totalPaidOut += payout;
    if (payout > 0) p.hadPaidClaim = true;
    c.status = "paid";
    c.payoutAmount = payout;
    c.resolvedTs = this.clock(s);
    return this.tx(s);
  }

  async expireClaim(claimAddr: string) {
    await delay();
    const s = load();
    const c = s.claims.find((x) => x.address === claimAddr);
    if (!c || c.status !== "pending") fail("O sinistro não está pendente");
    if (this.clock(s) <= c.votingDeadline) fail("Período de votação ainda em andamento");
    c.status = "rejected";
    c.resolvedTs = this.clock(s);
    s.pool.pendingClaims -= c.amountRequested;
    const p = s.policies.find((x) => x.address === c.policy);
    if (p) p.hasOpenClaim = false;
    return this.tx(s);
  }

  async settle(policyAddr: string) {
    await delay();
    const s = load();
    const p = s.policies.find((x) => x.address === policyAddr);
    if (!p || p.status !== "active") fail("A apólice não está ativa");
    const now = this.clock(s);
    const ended = now > p.endTs;
    const lapsed = isLapsed(p, now, s.pool.params.installmentGraceSecs);
    if (!ended && !lapsed) fail("A apólice ainda está vigente");
    if (p.hasOpenClaim) fail("Sinistro em aberto impede a liquidação da apólice");
    const fullyPaid = p.installmentsPaid >= p.installments;
    const pay = ended && fullyPaid && !p.hadPaidClaim && p.inspected && p.cashbackAmount > 0;
    if (pay) {
      s.pool.vaultBalance -= p.cashbackAmount;
      s.pool.totalCashbackPaid += p.cashbackAmount;
      this.credit(s, p.owner, p.cashbackAmount);
    }
    s.pool.reservedCashback -= p.cashbackAmount;
    if (!p.inspected) {
      s.pool.pendingInspectionFees -= p.inspectionFee;
      s.pool.treasuryAccrued += p.inspectionFee;
    }
    s.pool.totalActiveCoverage -= p.coverageLimit - p.totalPaidOut;
    s.pool.activePolicies -= 1;
    p.status = "settled";
    p.cashbackRedeemed = pay;
    if (!pay) p.cashbackAmount = 0;
    if (s.vehicles[p.plate] === p.address) delete s.vehicles[p.plate];
    return this.tx(s);
  }

  // ---------- governanca (na demonstracao o usuario e a autoridade) ----------

  async proposeParams(params: PoolParams) {
    await delay();
    if (!validParams(params)) fail("Parâmetro inválido");
    const s = load();
    s.pool.pendingParams = { ...params };
    s.pool.pendingParamsEta = this.clock(s) + s.pool.params.governanceDelaySecs;
    return this.tx(s);
  }

  async applyParams() {
    await delay();
    const s = load();
    if (!s.pool.pendingParams) fail("Não há mudança de governança pendente");
    if (this.clock(s) < s.pool.pendingParamsEta) fail("Timelock de governança ainda não expirou");
    s.pool.params = s.pool.pendingParams;
    s.pool.pendingParams = null;
    s.pool.pendingParamsEta = 0;
    return this.tx(s);
  }

  async proposeAssessors(assessors: string[], threshold: number) {
    await delay();
    if (!assessors.length || assessors.length > 5 || new Set(assessors).size !== assessors.length)
      fail("Parâmetro inválido");
    if (threshold < 1 || threshold > assessors.length) fail("Parâmetro inválido");
    const s = load();
    s.pool.pendingAssessors = [...assessors];
    s.pool.pendingThreshold = threshold;
    s.pool.pendingAssessorsEta = this.clock(s) + s.pool.params.governanceDelaySecs;
    return this.tx(s);
  }

  async applyAssessors() {
    await delay();
    const s = load();
    if (!s.pool.pendingAssessors.length) fail("Não há mudança de governança pendente");
    if (this.clock(s) < s.pool.pendingAssessorsEta) fail("Timelock de governança ainda não expirou");
    s.pool.assessors = s.pool.pendingAssessors;
    s.pool.approvalThreshold = s.pool.pendingThreshold;
    s.pool.pendingAssessors = [];
    s.pool.pendingThreshold = 0;
    s.pool.pendingAssessorsEta = 0;
    return this.tx(s);
  }

  async cancelPending() {
    await delay();
    const s = load();
    s.pool.pendingParams = null;
    s.pool.pendingParamsEta = 0;
    s.pool.pendingAssessors = [];
    s.pool.pendingThreshold = 0;
    s.pool.pendingAssessorsEta = 0;
    s.pool.pendingAuthority = null;
    return this.tx(s);
  }

  async setPaused(paused: boolean) {
    await delay();
    const s = load();
    s.pool.paused = paused;
    return this.tx(s);
  }

  async proposeAuthority(newAuthority: string) {
    await delay();
    const s = load();
    s.pool.pendingAuthority = newAuthority;
    return this.tx(s);
  }

  async acceptAuthority() {
    await delay();
    const s = load();
    if (!s.pool.pendingAuthority) fail("Assinante não é a autoridade proposta");
    s.pool.authority = s.pool.pendingAuthority;
    s.pool.pendingAuthority = null;
    return this.tx(s);
  }

  async withdrawTreasury(amount: number) {
    await delay();
    const s = load();
    if (amount <= 0) fail("Quantidade deve ser maior que zero");
    if (amount > s.pool.treasuryAccrued) fail("Saldo insuficiente na tesouraria do protocolo");
    s.pool.vaultBalance -= amount;
    s.pool.treasuryAccrued -= amount;
    this.credit(s, this.wallet, amount);
    return this.tx(s);
  }
}
