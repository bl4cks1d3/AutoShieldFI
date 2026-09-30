// Tipos normalizados usados pela interface. Valores monetarios sao sempre
// inteiros em unidades base do token (6 casas decimais).

export type Tier = "basic" | "standard" | "premium" | "theftOnly" | "appDriver";
export type DeductibleOption = "reduced" | "normal" | "increased";
export type ClaimKind = "theft" | "collision" | "thirdParty" | "naturalEvent" | "other";
/** appealed = em recurso (nova votacao por quem nao votou na primeira rodada). */
export type ClaimStatus = "pending" | "approved" | "rejected" | "paid" | "appealed";
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
  /** Dias de cobertura sem sinistro para subir uma classe de bonus. */
  bonusDaysPerClass: number;
  /** Classe junior (primeira perda): cotas e capital. */
  juniorShares: number;
  juniorCapital: number;
  /** Peso da junior na divisao dos premios (bps; 20.000 = 2x). */
  juniorWeightBps: number;
  /** Garantias dos avaliadores (fora do patrimonio dos LPs). */
  assessorBonds: number;
  minAssessorBond: number;
  /** Parte da garantia perdida por voto contra o resultado (bps). */
  slashBps: number;
  totalSalvage: number;
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
  /** Classe de bonus do titular na contratacao (4% de desconto por classe). */
  bonusClass: number;
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
  /** Carteira da oficina credenciada que recebe a indenizacao (danos parciais). */
  repairShop: string | null;
  appealed: boolean;
  appealVoters: string[];
  appealTs: number;
  /** Avaliadores sorteados para a primeira rodada. */
  panel: string[];
  voteBits: number;
  appealVoteBits: number;
  settledBits: number;
  appealSettledBits: number;
  salvageRecovered: number;
}

export interface RepairShopInfo {
  address: string;
  wallet: string;
  name: string;
  city: string;
  active: boolean;
  claimsPaid: number;
  totalReceived: number;
}

/** Historico do motorista: classe de bonus de renovacao. */
export interface DriverInfo {
  bonusClass: number;
  cleanDays: number;
  cleanPolicies: number;
  paidClaims: number;
}

export interface StakeInfo {
  shares: number;
  totalDeposited: number;
  totalWithdrawn: number;
  lastDepositTs: number;
  pendingWithdrawShares: number;
  withdrawAvailableAt: number;
  juniorShares: number;
  pendingJuniorWithdraw: number;
}

/** Garantia e reputacao de um avaliador. */
export interface AssessorInfo {
  bond: number;
  votes: number;
  correctVotes: number;
  wrongVotes: number;
  slashed: number;
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
  /** Carteira da oficina credenciada escolhida (danos parciais), ou null. */
  repairShop?: string | null;
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
  getRepairShops(): Promise<RepairShopInfo[]>;
  getDriver(owner: string): Promise<DriverInfo | null>;
  getAssessor(assessor: string): Promise<AssessorInfo | null>;

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
  /** Recurso contra sinistro recusado (uma vez, ate 7 dias apos a recusa). */
  appealClaim(claim: string): Promise<string>;
  /** Classe junior (primeira perda). */
  depositJunior(amount: number): Promise<string>;
  requestJuniorWithdraw(shares: number): Promise<string>;
  withdrawJunior(shares: number): Promise<string>;
  /** Garantia dos avaliadores. */
  /** `as`: identidade do avaliador simulado (so na demonstracao). */
  postBond(amount: number, as?: string): Promise<string>;
  withdrawBond(amount: number, as?: string): Promise<string>;
  /** Liquida os votos de um avaliador num sinistro encerrado. */
  settleVote(claim: string, assessor: string): Promise<string>;
  /** Governanca: salvados e parametros de risco. */
  recordSalvage(claim: string, amount: number): Promise<string>;
  setRiskParams(juniorWeightBps: number, minAssessorBond: number, slashBps: number): Promise<string>;
  /** Governanca: credenciamento de oficinas. */
  registerShop(wallet: string, name: string, city: string): Promise<string>;
  setShopActive(wallet: string, active: boolean): Promise<string>;

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
