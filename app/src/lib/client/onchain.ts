import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import idl from "@/idl/autoshield.json";
import type { Autoshield } from "@/idl/autoshield";
import type {
  AutoShieldClient,
  ClaimInfo,
  ClaimInput,
  PolicyInfo,
  PoolInfo,
  PoolParams,
  PurchaseInput,
  StakeInfo,
  ClaimKind,
  DriverInfo,
  RepairShopInfo,
} from "../types";
import { isTotalLoss } from "../pricing";
import { PROGRAM_ID } from "../config";
import { lookupPlate, plateHash, rememberPlate, toHex } from "../plate";

/* eslint-disable @typescript-eslint/no-explicit-any */

const n = (v: BN | number) => (typeof v === "number" ? v : Number(v.toString()));
const enumKey = <T extends string>(v: object) => Object.keys(v)[0] as T;
const enumVal = (k: string) => ({ [k]: {} }) as any;

function mapParams(p: any): PoolParams {
  return {
    baseRateBps: p.baseRateBps,
    cashbackBps: p.cashbackBps,
    protocolFeeBps: p.protocolFeeBps,
    minCollateralBps: p.minCollateralBps,
    withdrawCooldownSecs: n(p.withdrawCooldownSecs),
    claimVotingSecs: n(p.claimVotingSecs),
    secondsPerDay: n(p.secondsPerDay),
    claimWaitingSecs: n(p.claimWaitingSecs),
    installmentGraceSecs: n(p.installmentGraceSecs),
    governanceDelaySecs: n(p.governanceDelaySecs),
    inspectionFee: n(p.inspectionFee),
    voteReward: n(p.voteReward),
    minVehicleValue: n(p.minVehicleValue),
    inspectionThreshold: p.inspectionThreshold,
    withdrawNoticeSecs: n(p.withdrawNoticeSecs),
    maxPolicyCoverageBps: p.maxPolicyCoverageBps,
    faucetEnabled: p.faucetEnabled,
  };
}

function toChainParams(p: PoolParams) {
  return {
    baseRateBps: p.baseRateBps,
    cashbackBps: p.cashbackBps,
    protocolFeeBps: p.protocolFeeBps,
    minCollateralBps: p.minCollateralBps,
    withdrawCooldownSecs: new BN(p.withdrawCooldownSecs),
    claimVotingSecs: new BN(p.claimVotingSecs),
    secondsPerDay: new BN(p.secondsPerDay),
    claimWaitingSecs: new BN(p.claimWaitingSecs),
    installmentGraceSecs: new BN(p.installmentGraceSecs),
    governanceDelaySecs: new BN(p.governanceDelaySecs),
    inspectionFee: new BN(p.inspectionFee),
    voteReward: new BN(p.voteReward),
    minVehicleValue: new BN(p.minVehicleValue),
    inspectionThreshold: p.inspectionThreshold,
    withdrawNoticeSecs: new BN(p.withdrawNoticeSecs),
    maxPolicyCoverageBps: p.maxPolicyCoverageBps,
    faucetEnabled: p.faucetEnabled,
  };
}

/** Carteira somente-leitura para consultas sem carteira conectada. */
class ReadonlyWallet implements AnchorWallet {
  publicKey = Keypair.generate().publicKey;
  async signTransaction<T extends Transaction | VersionedTransaction>(): Promise<T> {
    throw new Error("Conecte uma carteira para assinar transações");
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(): Promise<T[]> {
    throw new Error("Conecte uma carteira para assinar transações");
  }
}

export class OnChainClient implements AutoShieldClient {
  readonly mode = "chain" as const;
  readonly wallet: string | null;
  readonly assessorIdentities: string[];
  private program: Program<Autoshield>;
  private programId: PublicKey;
  private poolPda: PublicKey;
  private vaultPda: PublicKey;
  private mintCache: PublicKey | null = null;

  private vehiclePda(hash: number[] | Uint8Array): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("vehicle"), Buffer.from(hash)], this.programId)[0];
  }

  constructor(
    private connection: Connection,
    anchorWallet: AnchorWallet | null,
  ) {
    const provider = new AnchorProvider(connection, anchorWallet ?? new ReadonlyWallet(), {
      commitment: "confirmed",
    });
    this.programId = new PublicKey(PROGRAM_ID);
    this.program = new Program<Autoshield>({ ...(idl as any), address: PROGRAM_ID }, provider);
    this.wallet = anchorWallet ? anchorWallet.publicKey.toBase58() : null;
    this.assessorIdentities = this.wallet ? [this.wallet] : [];
    [this.poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool_v2")], this.programId);
    [this.vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), this.poolPda.toBuffer()],
      this.programId,
    );
  }

  private me(): PublicKey {
    if (!this.wallet) throw new Error("Conecte sua carteira Solana");
    return new PublicKey(this.wallet);
  }

  private async mint(): Promise<PublicKey> {
    if (this.mintCache) return this.mintCache;
    const pool = await this.program.account.pool.fetch(this.poolPda);
    this.mintCache = pool.stableMint;
    return pool.stableMint;
  }

  async now(): Promise<number> {
    try {
      const slot = await this.connection.getSlot();
      const t = await this.connection.getBlockTime(slot);
      if (t) return t;
    } catch {
      /* usa relogio local */
    }
    return Math.floor(Date.now() / 1000);
  }

  async getPool(): Promise<PoolInfo | null> {
    const p = await this.program.account.pool.fetchNullable(this.poolPda);
    if (!p) return null;
    this.mintCache = p.stableMint;
    let vaultBalance = 0;
    try {
      vaultBalance = Number((await getAccount(this.connection, this.vaultPda)).amount);
    } catch {
      /* cofre ainda nao existe */
    }
    return {
      address: this.poolPda.toBase58(),
      authority: p.authority.toBase58(),
      stableMint: p.stableMint.toBase58(),
      vault: p.vault.toBase58(),
      vaultBalance,
      totalShares: n(p.totalShares),
      totalActiveCoverage: n(p.totalActiveCoverage),
      reservedCashback: n(p.reservedCashback),
      pendingClaims: n(p.pendingClaims),
      totalPremiums: n(p.totalPremiums),
      totalClaimsPaid: n(p.totalClaimsPaid),
      totalCashbackPaid: n(p.totalCashbackPaid),
      policyCount: n(p.policyCount),
      claimCount: n(p.claimCount),
      activePolicies: n(p.activePolicies),
      params: mapParams(p.params),
      assessors: p.assessors.map((a) => a.toBase58()),
      approvalThreshold: p.approvalThreshold,
      paused: p.paused,
      treasuryAccrued: n(p.treasuryAccrued),
      pendingInspectionFees: n(p.pendingInspectionFees),
      totalProtocolFees: n(p.totalProtocolFees),
      totalAssessorRewards: n(p.totalAssessorRewards),
      pendingParams: p.pendingParams ? mapParams(p.pendingParams) : null,
      pendingParamsEta: n(p.pendingParamsEta),
      pendingAssessors: p.pendingAssessors.map((a) => a.toBase58()),
      pendingThreshold: p.pendingThreshold,
      pendingAssessorsEta: n(p.pendingAssessorsEta),
      pendingAuthority: p.pendingAuthority.equals(PublicKey.default) ? null : p.pendingAuthority.toBase58(),
      oracle: p.oracle.toBase58(),
      bonusDaysPerClass: p.bonusDaysPerClass || 365,
    };
  }

  async getBalance(owner: string): Promise<number> {
    try {
      const ata = getAssociatedTokenAddressSync(await this.mint(), new PublicKey(owner));
      return Number((await getAccount(this.connection, ata)).amount);
    } catch {
      return 0;
    }
  }

  private mapPolicy(address: PublicKey, p: any): PolicyInfo {
    return {
      address: address.toBase58(),
      owner: p.owner.toBase58(),
      id: n(p.id),
      nonce: p.nonce.toString(),
      plateHash: toHex(p.plateHash),
      plate: lookupPlate(toHex(p.plateHash)),
      model: p.model,
      year: p.year,
      vehicleValue: n(p.vehicleValue),
      tier: enumKey(p.tier),
      durationDays: p.durationDays,
      premiumPaid: n(p.premiumPaid),
      coverageLimit: n(p.coverageLimit),
      deductible: n(p.deductible),
      cashbackAmount: n(p.cashbackAmount),
      startTs: n(p.startTs),
      endTs: n(p.endTs),
      status: enumKey(p.status),
      claimsFiled: p.claimsFiled,
      hasOpenClaim: p.hasOpenClaim,
      hadPaidClaim: p.hadPaidClaim,
      totalPaidOut: n(p.totalPaidOut),
      cashbackRedeemed: p.cashbackRedeemed,
      inspected: p.inspected,
      inspector: p.inspector.toBase58(),
      inspectionApprovals: p.inspectionApprovals,
      inspectionRejections: p.inspectionRejections,
      inspectionVoters: p.inspectionVoters.map((v: PublicKey) => v.toBase58()),
      inspectionFeePaid: n(p.inspectionFeePaid),
      claimsAllowedFrom: n(p.claimsAllowedFrom),
      premiumTotal: n(p.premiumTotal),
      installments: p.installments,
      installmentsPaid: p.installmentsPaid,
      installmentPeriod: n(p.installmentPeriod),
      protocolFeesPaid: n(p.protocolFeesPaid),
      inspectionFee: n(p.inspectionFee),
      fipePct: p.fipePct,
      deductibleOption: enumKey(p.deductibleOption),
      fipeCode: p.fipeCode,
      fipeUpdatedTs: n(p.fipeUpdatedTs),
      pendingOwner: p.pendingOwner.equals(PublicKey.default) ? null : p.pendingOwner.toBase58(),
      bonusClass: p.bonusClass,
    };
  }

  private mapClaim(address: PublicKey, c: any): ClaimInfo {
    return {
      address: address.toBase58(),
      policy: c.policy.toBase58(),
      claimant: c.claimant.toBase58(),
      id: n(c.id),
      index: c.index,
      kind: enumKey(c.kind),
      originalKind: enumKey(c.originalKind),
      reclassified: c.reclassified,
      totalLoss: c.totalLoss,
      amountRequested: n(c.amountRequested),
      payoutAmount: n(c.payoutAmount),
      description: c.description,
      evidenceUri: c.evidenceUri,
      status: enumKey(c.status),
      approvals: c.approvals,
      rejections: c.rejections,
      voters: c.voters.map((v: PublicKey) => v.toBase58()),
      createdTs: n(c.createdTs),
      votingDeadline: n(c.votingDeadline),
      resolvedTs: n(c.resolvedTs),
      repairShop: c.repairShop.equals(PublicKey.default) ? null : c.repairShop.toBase58(),
      appealed: c.appealed,
      appealVoters: c.appealVoters.map((v: PublicKey) => v.toBase58()),
      appealTs: n(c.appealTs),
    };
  }

  async getPolicies(owner?: string): Promise<PolicyInfo[]> {
    // layout: discriminador(8) + version(1) + owner(32)
    const filters = owner ? [{ memcmp: { offset: 9, bytes: owner } }] : [];
    const all = await this.program.account.policy.all(filters);
    return all.map((a) => this.mapPolicy(a.publicKey, a.account)).sort((a, b) => b.startTs - a.startTs);
  }

  async getClaims(owner?: string): Promise<ClaimInfo[]> {
    // layout: discriminador(8) + version(1) + policy(32) + claimant(32)
    const filters = owner ? [{ memcmp: { offset: 41, bytes: owner } }] : [];
    const all = await this.program.account.claim.all(filters);
    return all.map((a) => this.mapClaim(a.publicKey, a.account)).sort((a, b) => b.createdTs - a.createdTs);
  }

  private shopPda(wallet: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("shop"), wallet.toBuffer()], this.programId)[0];
  }

  async getRepairShops(): Promise<RepairShopInfo[]> {
    const all = await this.program.account.repairShop.all();
    return all
      .map(({ publicKey, account: s }) => ({
        address: publicKey.toBase58(),
        wallet: s.wallet.toBase58(),
        name: s.name,
        city: s.city,
        active: s.active,
        claimsPaid: s.claimsPaid,
        totalReceived: n(s.totalReceived),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getDriver(owner: string): Promise<DriverInfo | null> {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("driver"), new PublicKey(owner).toBuffer()],
      this.programId,
    );
    const d = await this.program.account.driverRecord.fetchNullable(pda);
    if (!d) return null;
    return { bonusClass: d.bonusClass, cleanDays: d.cleanDays, cleanPolicies: d.cleanPolicies, paidClaims: d.paidClaims };
  }

  async getStake(owner: string): Promise<StakeInfo | null> {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), this.poolPda.toBuffer(), new PublicKey(owner).toBuffer()],
      this.programId,
    );
    const s = await this.program.account.stakePosition.fetchNullable(pda);
    if (!s) return null;
    return {
      shares: n(s.shares),
      totalDeposited: n(s.totalDeposited),
      totalWithdrawn: n(s.totalWithdrawn),
      lastDepositTs: n(s.lastDepositTs),
      pendingWithdrawShares: n(s.pendingWithdrawShares),
      withdrawAvailableAt: n(s.withdrawAvailableAt),
    };
  }

  async faucet(amount: number): Promise<string> {
    return this.program.methods.faucet(new BN(amount)).accounts({ user: this.me() }).rpc();
  }

  private tokenAccounts(owner: PublicKey, mint: PublicKey) {
    return {
      pool: this.poolPda,
      stableMint: mint,
      vault: this.vaultPda,
      ownerToken: getAssociatedTokenAddressSync(mint, owner),
    };
  }

  async deposit(amount: number): Promise<string> {
    const me = this.me();
    const mint = await this.mint();
    return this.program.methods
      .depositLiquidity(new BN(amount))
      .accountsPartial({ owner: me, ...this.tokenAccounts(me, mint) })
      .rpc();
  }

  async requestWithdraw(shares: number): Promise<string> {
    const me = this.me();
    return this.program.methods
      .requestWithdrawal(new BN(shares))
      .accountsPartial({ owner: me, pool: this.poolPda })
      .rpc();
  }

  async closePolicy(policyAddr: string): Promise<string> {
    const policy = new PublicKey(policyAddr);
    const p = await this.program.account.policy.fetch(policy);
    const caller = this.me();
    // fecha antes os sinistros resolvidos da apolice que ainda existem
    const claimIxs = [];
    for (let i = 0; i < p.claimsFiled; i++) {
      const [claim] = PublicKey.findProgramAddressSync(
        [Buffer.from("claim"), policy.toBuffer(), Buffer.from([i])],
        this.programId,
      );
      const c = await this.program.account.claim.fetchNullable(claim);
      if (c && ("paid" in c.status || "rejected" in c.status)) {
        claimIxs.push(
          await this.program.methods
            .closeClaim()
            .accountsPartial({ caller, claim, claimant: c.claimant })
            .instruction(),
        );
      }
    }
    return this.program.methods
      .closePolicy()
      .accountsPartial({ caller, policy, owner: p.owner })
      .preInstructions(claimIxs)
      .rpc();
  }

  async withdraw(shares: number): Promise<string> {
    const me = this.me();
    const mint = await this.mint();
    return this.program.methods
      .withdrawLiquidity(new BN(shares))
      .accountsPartial({ owner: me, ...this.tokenAccounts(me, mint) })
      .rpc();
  }

  async purchase(input: PurchaseInput): Promise<string> {
    const me = this.me();
    rememberPlate(input.plate);
    const mint = await this.mint();
    const nonce = new BN(Date.now());
    const [policy] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), me.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      this.programId,
    );
    return this.program.methods
      .purchasePolicy({
        nonce,
        plateHash: plateHash(input.plate),
        model: input.model,
        year: input.year,
        vehicleValue: new BN(input.vehicleValue),
        tier: enumVal(input.tier),
        durationDays: input.durationDays,
        installments: input.installments,
        maxPremium: new BN(input.maxPremium),
        fipePct: input.fipePct,
        deductibleOption: enumVal(input.deductibleOption),
        fipeCode: input.fipeCode.slice(0, 16),
      })
      .accountsPartial({
        owner: me,
        ...this.tokenAccounts(me, mint),
        policy,
        vehicle: this.vehiclePda(plateHash(input.plate)),
      })
      .rpc();
  }

  async fileClaim(policyAddr: string, input: ClaimInput): Promise<string> {
    const me = this.me();
    const policy = new PublicKey(policyAddr);
    const p = await this.program.account.policy.fetch(policy);
    const [claim] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), policy.toBuffer(), Buffer.from([p.claimsFiled])],
      this.programId,
    );
    return this.program.methods
      .fileClaim({
        kind: enumVal(input.kind),
        amount: new BN(input.amount),
        description: input.description,
        evidenceUri: input.evidenceUri,
      })
      .accountsPartial({
        owner: me,
        pool: this.poolPda,
        policy,
        claim,
        repairShop: input.repairShop ? this.shopPda(new PublicKey(input.repairShop)) : null,
      })
      .rpc();
  }

  async vote(claimAddr: string, approve: boolean, _as?: string, reclassify?: ClaimKind): Promise<string> {
    const claim = new PublicKey(claimAddr);
    const c = await this.program.account.claim.fetch(claim);
    return this.program.methods
      .voteClaim(approve, approve && reclassify ? enumVal(reclassify) : null)
      .accountsPartial({
        assessor: this.me(),
        pool: this.poolPda,
        stableMint: await this.mint(),
        vault: this.vaultPda,
        policy: c.policy,
        claim,
      })
      .rpc();
  }

  async inspect(policyAddr: string, approve: boolean): Promise<string> {
    const policy = new PublicKey(policyAddr);
    const p = await this.program.account.policy.fetch(policy);
    const mint = await this.mint();
    return this.program.methods
      .inspectPolicy(approve)
      .accountsPartial({
        assessor: this.me(),
        pool: this.poolPda,
        stableMint: mint,
        vault: this.vaultPda,
        policy,
        vehicle: this.vehiclePda(p.plateHash),
        owner: p.owner,
      })
      .rpc();
  }

  async payClaim(claimAddr: string): Promise<string> {
    const claim = new PublicKey(claimAddr);
    const c = await this.program.account.claim.fetch(claim);
    const p = await this.program.account.policy.fetch(c.policy);
    const mint = await this.mint();
    // Danos parciais com oficina credenciada: o contrato paga direto a oficina.
    const totalLoss = isTotalLoss(enumKey<ClaimKind>(c.kind), n(c.amountRequested), n(p.coverageLimit));
    const toShop = !totalLoss && !c.repairShop.equals(PublicKey.default);
    const payee = toShop ? c.repairShop : c.claimant;
    return this.program.methods
      .payClaim()
      .accountsPartial({
        payer: this.me(),
        pool: this.poolPda,
        stableMint: mint,
        vault: this.vaultPda,
        policy: c.policy,
        claim,
        vehicle: this.vehiclePda(p.plateHash),
        claimant: c.claimant,
        payee,
        repairShop: toShop ? this.shopPda(c.repairShop) : null,
      })
      .rpc();
  }

  async expireClaim(claimAddr: string): Promise<string> {
    const claim = new PublicKey(claimAddr);
    const c = await this.program.account.claim.fetch(claim);
    return this.program.methods
      .expireClaim()
      .accountsPartial({ caller: this.me(), pool: this.poolPda, policy: c.policy, claim })
      .rpc();
  }

  async settle(policyAddr: string): Promise<string> {
    const policy = new PublicKey(policyAddr);
    const p = await this.program.account.policy.fetch(policy);
    const mint = await this.mint();
    return this.program.methods
      .settlePolicy()
      .accountsPartial({
        payer: this.me(),
        pool: this.poolPda,
        stableMint: mint,
        vault: this.vaultPda,
        policy,
        vehicle: this.vehiclePda(p.plateHash),
        owner: p.owner,
      })
      .rpc();
  }

  private admin() {
    return { authority: this.me(), pool: this.poolPda };
  }

  async cancelPolicy(policyAddr: string): Promise<string> {
    const me = this.me();
    const policy = new PublicKey(policyAddr);
    const p = await this.program.account.policy.fetch(policy);
    const mint = await this.mint();
    return this.program.methods
      .cancelPolicy()
      .accountsPartial({
        owner: me,
        pool: this.poolPda,
        stableMint: mint,
        vault: this.vaultPda,
        policy,
        vehicle: this.vehiclePda(p.plateHash),
      })
      .rpc();
  }

  async appealClaim(claimAddr: string): Promise<string> {
    const claim = new PublicKey(claimAddr);
    const c = await this.program.account.claim.fetch(claim);
    return this.program.methods
      .appealClaim()
      .accountsPartial({ owner: this.me(), pool: this.poolPda, policy: c.policy, claim })
      .rpc();
  }

  async registerShop(wallet: string, name: string, city: string): Promise<string> {
    const w = new PublicKey(wallet);
    return this.program.methods
      .registerShop(w, name.slice(0, 48), city.slice(0, 32))
      .accountsPartial({ authority: this.me(), pool: this.poolPda, shop: this.shopPda(w) })
      .rpc();
  }

  async setShopActive(wallet: string, active: boolean): Promise<string> {
    return this.program.methods
      .setShopActive(active)
      .accountsPartial({ authority: this.me(), pool: this.poolPda, shop: this.shopPda(new PublicKey(wallet)) })
      .rpc();
  }

  async proposeTransfer(policyAddr: string, newOwner: string | null): Promise<string> {
    return this.program.methods
      .proposeTransfer(newOwner ? new PublicKey(newOwner) : PublicKey.default)
      .accountsPartial({ owner: this.me(), policy: new PublicKey(policyAddr) })
      .rpc();
  }

  async acceptTransfer(policyAddr: string): Promise<string> {
    return this.program.methods
      .acceptTransfer()
      .accountsPartial({ newOwner: this.me(), policy: new PublicKey(policyAddr) })
      .rpc();
  }

  async payInstallment(policyAddr: string): Promise<string> {
    const me = this.me();
    const mint = await this.mint();
    return this.program.methods
      .payInstallment()
      .accountsPartial({ owner: me, ...this.tokenAccounts(me, mint), policy: new PublicKey(policyAddr) })
      .rpc();
  }

  async proposeParams(params: PoolParams): Promise<string> {
    return this.program.methods.proposeParams(toChainParams(params)).accountsPartial(this.admin()).rpc();
  }

  async applyParams(): Promise<string> {
    return this.program.methods.applyParams().accountsPartial({ caller: this.me(), pool: this.poolPda }).rpc();
  }

  async proposeAssessors(assessors: string[], threshold: number): Promise<string> {
    return this.program.methods
      .proposeAssessors(
        assessors.map((a) => new PublicKey(a)),
        threshold,
      )
      .accountsPartial(this.admin())
      .rpc();
  }

  async applyAssessors(): Promise<string> {
    return this.program.methods.applyAssessors().accountsPartial({ caller: this.me(), pool: this.poolPda }).rpc();
  }

  async cancelPending(): Promise<string> {
    return this.program.methods.cancelPending().accountsPartial(this.admin()).rpc();
  }

  async setPaused(paused: boolean): Promise<string> {
    return this.program.methods.setPaused(paused).accountsPartial(this.admin()).rpc();
  }

  async proposeAuthority(newAuthority: string): Promise<string> {
    return this.program.methods
      .proposeAuthority(new PublicKey(newAuthority))
      .accountsPartial(this.admin())
      .rpc();
  }

  async acceptAuthority(): Promise<string> {
    return this.program.methods
      .acceptAuthority()
      .accountsPartial({ newAuthority: this.me(), pool: this.poolPda })
      .rpc();
  }

  async withdrawTreasury(amount: number): Promise<string> {
    const me = this.me();
    const mint = await this.mint();
    const destination = getAssociatedTokenAddressSync(mint, me);
    return this.program.methods
      .withdrawTreasury(new BN(amount))
      .accountsPartial({ authority: me, pool: this.poolPda, stableMint: mint, vault: this.vaultPda, destination })
      .preInstructions([createAssociatedTokenAccountIdempotentInstruction(me, destination, me, mint)])
      .rpc();
  }
}
