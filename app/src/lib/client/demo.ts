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
import { FAUCET_MAX, MAX_DAYS, MIN_DAYS, TIER_COVERS, UNIT, expectedPayout, quote } from "../pricing";

// Simulacao local (localStorage) que replica as regras do programa on-chain.
// Permite demonstrar o fluxo completo sem carteira, SOL ou deploy.

const KEY = "autoshield-demo-v1";
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
}

function initialState(): DemoState {
  const seedLiquidity = 750_000 * UNIT;
  return {
    timeOffset: 0,
    txCount: 0,
    pool: {
      address: "PoolDemo111111111111111111111111111111111111",
      authority: "AdminDemo11111111111111111111111111111111111",
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
      params: {
        baseRateBps: 350,
        cashbackBps: 2000,
        minCollateralBps: 1000,
        withdrawCooldownSecs: 7 * 86400,
        claimVotingSecs: 3 * 86400,
        secondsPerDay: 86400,
        faucetEnabled: true,
      },
      assessors: DEMO_ASSESSORS,
      approvalThreshold: 2,
      paused: false,
    },
    balances: {},
    policies: [],
    claims: [],
    stakes: {},
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

  private nav(s: DemoState) {
    return Math.max(0, s.pool.vaultBalance - s.pool.reservedCashback);
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
    if (amount <= 0) fail("Quantidade deve ser maior que zero");
    const nav = this.nav(s);
    const shares =
      s.pool.totalShares === 0 ? amount : Math.floor((amount * s.pool.totalShares) / Math.max(nav, 1));
    this.debit(s, this.wallet, amount);
    s.pool.vaultBalance += amount;
    s.pool.totalShares += shares;
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
    if (s.pool.paused) fail("O protocolo está pausado");
    if (input.durationDays < MIN_DAYS || input.durationDays > MAX_DAYS)
      fail("Duração da apólice fora do intervalo permitido (30 a 365 dias)");
    if (input.vehicleValue <= 0) fail("Valor do veículo inválido");
    if (!input.plate || input.plate.length > 10) fail("Placa inválida");
    const q = quote(s.pool.params, input.vehicleValue, input.tier, input.durationDays);
    if (q.premium <= 0) fail("Valor do veículo inválido");
    if (q.premium > input.maxPremium) fail("Prêmio acima do máximo aceito");
    const coverageAfter = s.pool.totalActiveCoverage + q.coverageLimit;
    const navAfter = s.pool.vaultBalance + q.premium - (s.pool.reservedCashback + q.cashback);
    if (navAfter < this.required(s, coverageAfter))
      fail("Liquidez insuficiente no pool para garantir a cobertura");
    this.debit(s, this.wallet, q.premium);
    const now = this.clock(s);
    const id = s.pool.policyCount;
    s.policies.push({
      address: `PolicyDemo${String(id).padStart(4, "0")}${Math.random().toString(36).slice(2, 10)}`,
      owner: this.wallet,
      id,
      nonce: String(Date.now()),
      plate: input.plate.toUpperCase(),
      model: input.model,
      year: input.year,
      vehicleValue: input.vehicleValue,
      tier: input.tier,
      durationDays: input.durationDays,
      premiumPaid: q.premium,
      coverageLimit: q.coverageLimit,
      deductible: q.deductible,
      cashbackAmount: q.cashback,
      startTs: now,
      endTs: now + input.durationDays * s.pool.params.secondsPerDay,
      status: "active",
      claimsFiled: 0,
      hasOpenClaim: false,
      hadPaidClaim: false,
      totalPaidOut: 0,
      cashbackRedeemed: false,
    });
    s.pool.vaultBalance += q.premium;
    s.pool.reservedCashback += q.cashback;
    s.pool.totalActiveCoverage = coverageAfter;
    s.pool.totalPremiums += q.premium;
    s.pool.policyCount += 1;
    s.pool.activePolicies += 1;
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
    return this.tx(s);
  }

  async payClaim(claimAddr: string) {
    await delay();
    const s = load();
    const c = s.claims.find((x) => x.address === claimAddr);
    if (!c || c.status !== "approved") fail("O sinistro não está aprovado");
    const p = s.policies.find((x) => x.address === c.policy)!;
    const payout = Math.min(
      expectedPayout(c.kind, c.amountRequested, p.deductible, p.coverageLimit - p.totalPaidOut),
      s.pool.vaultBalance,
    );
    s.pool.vaultBalance -= payout;
    this.credit(s, c.claimant, payout);
    s.pool.pendingClaims -= c.amountRequested;
    s.pool.totalActiveCoverage -= payout;
    s.pool.totalClaimsPaid += payout;
    if (payout > 0 && !p.hadPaidClaim) s.pool.reservedCashback -= p.cashbackAmount;
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
    if (this.clock(s) <= p.endTs) fail("A apólice ainda está vigente");
    if (p.hasOpenClaim) fail("Sinistro em aberto impede a liquidação da apólice");
    const pay = !p.hadPaidClaim && p.cashbackAmount > 0;
    if (pay) {
      s.pool.vaultBalance -= p.cashbackAmount;
      s.pool.reservedCashback -= p.cashbackAmount;
      s.pool.totalCashbackPaid += p.cashbackAmount;
      this.credit(s, p.owner, p.cashbackAmount);
    }
    s.pool.totalActiveCoverage -= p.coverageLimit - p.totalPaidOut;
    s.pool.activePolicies -= 1;
    p.status = "settled";
    p.cashbackRedeemed = pay;
    return this.tx(s);
  }

  // Na demonstracao o usuario tambem atua como autoridade do pool.
  async updateParams(params: PoolParams) {
    await delay();
    if (!validParams(params)) fail("Parâmetro inválido");
    const s = load();
    s.pool.params = { ...params };
    return this.tx(s);
  }

  async setAssessors(assessors: string[], threshold: number) {
    await delay();
    if (!assessors.length || assessors.length > 5 || new Set(assessors).size !== assessors.length)
      fail("Parâmetro inválido");
    if (threshold < 1 || threshold > assessors.length) fail("Parâmetro inválido");
    const s = load();
    s.pool.assessors = [...assessors];
    s.pool.approvalThreshold = threshold;
    return this.tx(s);
  }

  async setPaused(paused: boolean) {
    await delay();
    const s = load();
    s.pool.paused = paused;
    return this.tx(s);
  }

  async transferAuthority(newAuthority: string) {
    await delay();
    const s = load();
    s.pool.authority = newAuthority;
    return this.tx(s);
  }
}

function validParams(p: PoolParams) {
  return (
    p.baseRateBps > 0 &&
    p.baseRateBps <= 5_000 &&
    p.cashbackBps <= 5_000 &&
    p.minCollateralBps > 0 &&
    p.minCollateralBps <= 10_000 &&
    p.withdrawCooldownSecs >= 0 &&
    p.claimVotingSecs > 0 &&
    p.secondsPerDay > 0 &&
    p.secondsPerDay <= 86_400
  );
}
