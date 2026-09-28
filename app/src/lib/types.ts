// Tipos normalizados usados pela interface. Valores monetarios sao sempre
// inteiros em unidades base do token (6 casas decimais).

export type Tier = "basic" | "standard" | "premium";
export type ClaimKind = "theft" | "collision" | "thirdParty" | "naturalEvent" | "other";
export type ClaimStatus = "pending" | "approved" | "rejected" | "paid";
export type PolicyStatus = "active" | "settled" | "cancelled";

export interface PoolParams {
  baseRateBps: number;
  cashbackBps: number;
  minCollateralBps: number;
  withdrawCooldownSecs: number;
  claimVotingSecs: number;
  secondsPerDay: number;
  claimWaitingSecs: number;
  faucetEnabled: boolean;
}

export interface PoolInfo {
  address: string;
  authority: string;
  stableMint: string;
  vault: string;
  vaultBalance: number;
  totalShares: number;
  totalActiveCoverage: number;
  reservedCashback: number;
  pendingClaims: number;
  totalPremiums: number;
  totalClaimsPaid: number;
  totalCashbackPaid: number;
  policyCount: number;
  claimCount: number;
  activePolicies: number;
  params: PoolParams;
  assessors: string[];
  approvalThreshold: number;
  paused: boolean;
}

export interface PolicyInfo {
  address: string;
  owner: string;
  id: number;
  nonce: string;
  plate: string;
  model: string;
  year: number;
  vehicleValue: number;
  tier: Tier;
  durationDays: number;
  premiumPaid: number;
  coverageLimit: number;
  deductible: number;
  cashbackAmount: number;
  startTs: number;
  endTs: number;
  status: PolicyStatus;
  claimsFiled: number;
  hasOpenClaim: boolean;
  hadPaidClaim: boolean;
  totalPaidOut: number;
  cashbackRedeemed: boolean;
  inspected: boolean;
  inspector: string;
  claimsAllowedFrom: number;
}

export interface ClaimInfo {
  address: string;
  policy: string;
  claimant: string;
  id: number;
  index: number;
  kind: ClaimKind;
  amountRequested: number;
  payoutAmount: number;
  description: string;
  evidenceUri: string;
  status: ClaimStatus;
  approvals: number;
  rejections: number;
  voters: string[];
  createdTs: number;
  votingDeadline: number;
  resolvedTs: number;
}

export interface StakeInfo {
  shares: number;
  totalDeposited: number;
  totalWithdrawn: number;
  lastDepositTs: number;
}

export interface PurchaseInput {
  plate: string;
  model: string;
  year: number;
  vehicleValue: number;
  tier: Tier;
  durationDays: number;
  maxPremium: number;
}

export interface ClaimInput {
  kind: ClaimKind;
  amount: number;
  description: string;
  evidenceUri: string;
}

export interface AutoShieldClient {
  readonly mode: "demo" | "chain";
  /** Endereco da carteira ativa (null se desconectada). */
  readonly wallet: string | null;
  /** Identidades que podem votar como avaliador nesta sessao. */
  readonly assessorIdentities: string[];

  now(): Promise<number>;
  getPool(): Promise<PoolInfo | null>;
  getBalance(owner: string): Promise<number>;
  getPolicies(owner?: string): Promise<PolicyInfo[]>;
  getClaims(owner?: string): Promise<ClaimInfo[]>;
  getStake(owner: string): Promise<StakeInfo | null>;

  faucet(amount: number): Promise<string>;
  deposit(amount: number): Promise<string>;
  withdraw(shares: number): Promise<string>;
  purchase(input: PurchaseInput): Promise<string>;
  fileClaim(policy: string, input: ClaimInput): Promise<string>;
  vote(claim: string, approve: boolean, as?: string): Promise<string>;
  inspect(policy: string, approve: boolean, as?: string): Promise<string>;
  payClaim(claim: string): Promise<string>;
  expireClaim(claim: string): Promise<string>;
  settle(policy: string): Promise<string>;
}
