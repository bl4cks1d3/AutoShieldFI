// Tipos normalizados usados pela interface. Valores monetarios sao sempre
// inteiros em unidades base do token (6 casas decimais).

export type Tier = "basic" | "standard" | "premium" | "theftOnly";
export type DeductibleOption = "reduced" | "normal" | "increased";
export type ClaimKind = "theft" | "collision" | "thirdParty" | "naturalEvent" | "other";
export type ClaimStatus = "pending" | "approved" | "rejected" | "paid";
/** cancelled = recusada na vistoria; cancelledByOwner = arrependimento ou cancelamento pelo titular. */
export type PolicyStatus = "active" | "settled" | "cancelled" | "cancelledByOwner";

export interface PoolParams {
  baseRateBps: number;
  cashbackBps: number;
  protocolFeeBps: number;
  minCollateralBps: number;
  withdrawCooldownSecs: number;
  claimVotingSecs: number;
  secondsPerDay: number;
  claimWaitingSecs: number;
  installmentGraceSecs: number;
  governanceDelaySecs: number;
  inspectionFee: number;
  voteReward: number;
  minVehicleValue: number;
  inspectionThreshold: number;
  withdrawNoticeSecs: number;
  maxPolicyCoverageBps: number;
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
  /** Receita do protocolo no cofre (fora do patrimonio dos LPs). */
  treasuryAccrued: number;
  pendingInspectionFees: number;
  totalProtocolFees: number;
  totalAssessorRewards: number;
  /** Governanca com timelock. */
  pendingParams: PoolParams | null;
  pendingParamsEta: number;
  pendingAssessors: string[];
  pendingThreshold: number;
  pendingAssessorsEta: number;
  pendingAuthority: string | null;
  /** Carteira do servico que atualiza o valor FIPE das apolices. */
  oracle: string;
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
  inspectionApprovals: number;
  inspectionRejections: number;
  inspectionVoters: string[];
  inspectionFeePaid: number;
  /** sha256 (hex) da placa normalizada — e o que fica on-chain. */
  plateHash: string;
  claimsAllowedFrom: number;
  /** Premio total da vigencia; `premiumPaid` e o que ja foi pago. */
  premiumTotal: number;
  installments: number;
  installmentsPaid: number;
  installmentPeriod: number;
  protocolFeesPaid: number;
  inspectionFee: number;
  /** Percentual da FIPE contratado (90, 100 ou 110). */
  fipePct: number;
  deductibleOption: DeductibleOption;
  /** Codigo FIPE + ano ("005340-6|2014-3"), usado pelo oraculo; vazio se manual. */
  fipeCode: string;
  fipeUpdatedTs: number;
  /** Comprador indicado na venda do veiculo, aguardando aceite. */
  pendingOwner: string | null;
}

export interface ClaimInfo {
  address: string;
  policy: string;
  claimant: string;
  id: number;
  index: number;
  kind: ClaimKind;
  originalKind: ClaimKind;
  reclassified: boolean;
  /** Indenizado como perda total (cobertura integral, sem franquia). */
  totalLoss: boolean;
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
  pendingWithdrawShares: number;
  withdrawAvailableAt: number;
}

export interface PurchaseInput {
  plate: string;
  model: string;
  year: number;
  vehicleValue: number;
  tier: Tier;
  durationDays: number;
  installments: number;
  maxPremium: number;
  fipePct: number;
  deductibleOption: DeductibleOption;
  fipeCode: string;
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
  /** Pede o saque; so pode ser executado apos o aviso previo. */
  requestWithdraw(shares: number): Promise<string>;
  withdraw(shares: number): Promise<string>;
  /** Fecha a apolice encerrada (e seus sinistros resolvidos), devolvendo o aluguel. */
  closePolicy(policy: string): Promise<string>;
  purchase(input: PurchaseInput): Promise<string>;
  fileClaim(policy: string, input: ClaimInput): Promise<string>;
  vote(claim: string, approve: boolean, as?: string, reclassify?: ClaimKind): Promise<string>;
  inspect(policy: string, approve: boolean, as?: string): Promise<string>;
  payClaim(claim: string): Promise<string>;
  expireClaim(claim: string): Promise<string>;
  settle(policy: string): Promise<string>;

  payInstallment(policy: string): Promise<string>;
  /** Arrependimento (7 dias, devolucao integral) ou cancelamento proporcional. */
  cancelPolicy(policy: string): Promise<string>;
  /** Venda do veiculo: o titular indica o comprador (null cancela)... */
  proposeTransfer(policy: string, newOwner: string | null): Promise<string>;
  /** ...e o comprador aceita. */
  acceptTransfer(policy: string): Promise<string>;

  // Governanca: mudancas passam por timelock (propor -> aguardar -> aplicar).
  proposeParams(params: PoolParams): Promise<string>;
  applyParams(): Promise<string>;
  proposeAssessors(assessors: string[], threshold: number): Promise<string>;
  applyAssessors(): Promise<string>;
  cancelPending(): Promise<string>;
  setPaused(paused: boolean): Promise<string>;
  /** Transferencia de autoridade em dois passos. */
  proposeAuthority(newAuthority: string): Promise<string>;
  acceptAuthority(): Promise<string>;
  withdrawTreasury(amount: number): Promise<string>;
}
