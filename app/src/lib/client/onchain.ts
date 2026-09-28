import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
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
} from "../types";
import { PROGRAM_ID } from "../config";
import { plateHash } from "../plate";

/* eslint-disable @typescript-eslint/no-explicit-any */

const n = (v: BN | number) => (typeof v === "number" ? v : Number(v.toString()));
const enumKey = <T extends string>(v: object) => Object.keys(v)[0] as T;
const enumVal = (k: string) => ({ [k]: {} }) as any;

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
    [this.poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool")], this.programId);
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
      params: {
        baseRateBps: p.params.baseRateBps,
        cashbackBps: p.params.cashbackBps,
        minCollateralBps: p.params.minCollateralBps,
        withdrawCooldownSecs: n(p.params.withdrawCooldownSecs),
        claimVotingSecs: n(p.params.claimVotingSecs),
        secondsPerDay: n(p.params.secondsPerDay),
        claimWaitingSecs: n(p.params.claimWaitingSecs),
        faucetEnabled: p.params.faucetEnabled,
      },
      assessors: p.assessors.map((a) => a.toBase58()),
      approvalThreshold: p.approvalThreshold,
      paused: p.paused,
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
      plate: p.plate,
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
      claimsAllowedFrom: n(p.claimsAllowedFrom),
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
    };
  }

  async getPolicies(owner?: string): Promise<PolicyInfo[]> {
    const filters = owner ? [{ memcmp: { offset: 8, bytes: owner } }] : [];
    const all = await this.program.account.policy.all(filters);
    return all.map((a) => this.mapPolicy(a.publicKey, a.account)).sort((a, b) => b.startTs - a.startTs);
  }

  async getClaims(owner?: string): Promise<ClaimInfo[]> {
    // layout: discriminador(8) + policy(32) + claimant(32)
    const filters = owner ? [{ memcmp: { offset: 40, bytes: owner } }] : [];
    const all = await this.program.account.claim.all(filters);
    return all.map((a) => this.mapClaim(a.publicKey, a.account)).sort((a, b) => b.createdTs - a.createdTs);
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
    const mint = await this.mint();
    const nonce = new BN(Date.now());
    const [policy] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), me.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      this.programId,
    );
    return this.program.methods
      .purchasePolicy({
        nonce,
        plate: input.plate,
        plateHash: plateHash(input.plate),
        model: input.model,
        year: input.year,
        vehicleValue: new BN(input.vehicleValue),
        tier: enumVal(input.tier),
        durationDays: input.durationDays,
        maxPremium: new BN(input.maxPremium),
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
      .accountsPartial({ owner: me, pool: this.poolPda, policy, claim })
      .rpc();
  }

  async vote(claimAddr: string, approve: boolean): Promise<string> {
    const claim = new PublicKey(claimAddr);
    const c = await this.program.account.claim.fetch(claim);
    return this.program.methods
      .voteClaim(approve)
      .accountsPartial({ assessor: this.me(), pool: this.poolPda, policy: c.policy, claim })
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
    const mint = await this.mint();
    return this.program.methods
      .payClaim()
      .accountsPartial({
        payer: this.me(),
        pool: this.poolPda,
        stableMint: mint,
        vault: this.vaultPda,
        policy: c.policy,
        claim,
        claimant: c.claimant,
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

  async updateParams(params: PoolParams): Promise<string> {
    return this.program.methods
      .updateParams({
        baseRateBps: params.baseRateBps,
        cashbackBps: params.cashbackBps,
        minCollateralBps: params.minCollateralBps,
        withdrawCooldownSecs: new BN(params.withdrawCooldownSecs),
        claimVotingSecs: new BN(params.claimVotingSecs),
        secondsPerDay: new BN(params.secondsPerDay),
        claimWaitingSecs: new BN(params.claimWaitingSecs),
        faucetEnabled: params.faucetEnabled,
      })
      .accountsPartial(this.admin())
      .rpc();
  }

  async setAssessors(assessors: string[], threshold: number): Promise<string> {
    return this.program.methods
      .setAssessors(
        assessors.map((a) => new PublicKey(a)),
        threshold,
      )
      .accountsPartial(this.admin())
      .rpc();
  }

  async setPaused(paused: boolean): Promise<string> {
    return this.program.methods.setPaused(paused).accountsPartial(this.admin()).rpc();
  }

  async transferAuthority(newAuthority: string): Promise<string> {
    return this.program.methods
      .transferAuthority(new PublicKey(newAuthority))
      .accountsPartial(this.admin())
      .rpc();
  }
}
