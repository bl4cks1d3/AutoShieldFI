import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Autoshield } from "../target/types/autoshield";

const UNIT = 1_000_000; // 6 casas decimais
const brl = (v: number) => new BN(Math.round(v * UNIT));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Parametros de teste: 1 "dia" de apolice = 1 segundo.
const PARAMS = {
  baseRateBps: 350,
  cashbackBps: 2000,
  minCollateralBps: 1000,
  withdrawCooldownSecs: new BN(0),
  claimVotingSecs: new BN(15),
  secondsPerDay: new BN(1),
  faucetEnabled: true,
};

function quotePremium(value: BN, tierMult: number, days: number): BN {
  return value
    .mul(new BN(PARAMS.baseRateBps))
    .mul(new BN(tierMult))
    .mul(new BN(days))
    .div(new BN(10_000 * 100 * 365));
}

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e: any) {
    const msg = e?.error?.errorCode?.code ?? e?.message ?? String(e);
    expect(String(msg)).to.contain(code);
    return;
  }
  expect.fail(`esperava erro ${code}`);
}

describe("autoshield", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.autoshield as Program<Autoshield>;
  const pid = program.programId;

  const [poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool")], pid);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), poolPda.toBuffer()],
    pid,
  );
  const [mintPda] = PublicKey.findProgramAddressSync([Buffer.from("test_mint")], pid);

  const admin = provider.wallet as anchor.Wallet;
  const lp = Keypair.generate();
  const driver1 = Keypair.generate();
  const driver2 = Keypair.generate();
  const driver3 = Keypair.generate();
  const assessors = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const outsider = Keypair.generate();

  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mintPda, owner);
  const balance = async (owner: PublicKey) =>
    new BN((await getAccount(provider.connection, ata(owner))).amount.toString());
  const vaultBalance = async () =>
    new BN((await getAccount(provider.connection, vaultPda)).amount.toString());

  const policyPda = (owner: PublicKey, nonce: BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), owner.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      pid,
    )[0];
  const claimPda = (policy: PublicKey, index: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), policy.toBuffer(), Buffer.from([index])],
      pid,
    )[0];

  async function airdrop(pk: PublicKey) {
    const sig = await provider.connection.requestAirdrop(pk, 5 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  async function buy(
    driver: Keypair,
    nonce: BN,
    value: BN,
    tier: object,
    days: number,
    plate: string,
  ) {
    const policy = policyPda(driver.publicKey, nonce);
    await program.methods
      .purchasePolicy({
        nonce,
        plate,
        model: "VW Gol 1.0",
        year: 2020,
        vehicleValue: value,
        tier: tier as any,
        durationDays: days,
        maxPremium: value,
      })
      .accountsPartial({
        owner: driver.publicKey,
        pool: poolPda,
        stableMint: mintPda,
        vault: vaultPda,
        ownerToken: ata(driver.publicKey),
        policy,
      })
      .signers([driver])
      .rpc();
    return policy;
  }

  async function fileClaim(driver: Keypair, policy: PublicKey, index: number, kind: object, amount: BN) {
    const claim = claimPda(policy, index);
    await program.methods
      .fileClaim({
        kind: kind as any,
        amount,
        description: "Colisao traseira no semaforo",
        evidenceUri: "sha256:abc123",
      })
      .accountsPartial({ owner: driver.publicKey, pool: poolPda, policy, claim })
      .signers([driver])
      .rpc();
    return claim;
  }

  const vote = (assessor: Keypair, policy: PublicKey, claim: PublicKey, approve: boolean) =>
    program.methods
      .voteClaim(approve)
      .accountsPartial({ assessor: assessor.publicKey, pool: poolPda, policy, claim })
      .signers([assessor])
      .rpc();

  before(async () => {
    await Promise.all(
      [lp, driver1, driver2, driver3, outsider, ...assessors].map((k) => airdrop(k.publicKey)),
    );
  });

  it("cria o token de teste e inicializa o pool", async () => {
    await program.methods.initTestMint().accounts({ payer: admin.publicKey }).rpc();
    await program.methods
      .initializePool(
        PARAMS,
        assessors.map((a) => a.publicKey),
        2,
      )
      .accountsPartial({ authority: admin.publicKey, stableMint: mintPda })
      .rpc();

    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.stableMint.toBase58()).to.eq(mintPda.toBase58());
    expect(pool.vault.toBase58()).to.eq(vaultPda.toBase58());
    expect(pool.assessors.length).to.eq(3);
    expect(pool.approvalThreshold).to.eq(2);
  });

  it("faucet distribui tBRL e respeita o limite", async () => {
    for (const k of [lp, driver1, driver2, driver3]) {
      await program.methods.faucet(brl(150_000)).accounts({ user: k.publicKey }).signers([k]).rpc();
    }
    expect((await balance(lp.publicKey)).eq(brl(150_000))).to.be.true;
    await expectError(
      program.methods.faucet(brl(200_001)).accounts({ user: outsider.publicKey }).signers([outsider]).rpc(),
      "FaucetLimit",
    );
  });

  it("recusa apolice sem capital suficiente no pool", async () => {
    await expectError(buy(driver1, new BN(99), brl(50_000), { standard: {} }, 30, "ABC1D23"), "InsufficientPoolCapital");
  });

  it("provedor de liquidez deposita no pool", async () => {
    await program.methods
      .depositLiquidity(brl(100_000))
      .accountsPartial({
        owner: lp.publicKey,
        pool: poolPda,
        stableMint: mintPda,
        vault: vaultPda,
        ownerToken: ata(lp.publicKey),
      })
      .signers([lp])
      .rpc();
    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.totalShares.eq(brl(100_000))).to.be.true;
    expect((await vaultBalance()).eq(brl(100_000))).to.be.true;
  });

  let policy1: PublicKey;
  let policy2: PublicKey;
  let policy3: PublicKey;

  it("motorista contrata apolice com premio calculado on-chain", async () => {
    const before = await balance(driver1.publicKey);
    policy1 = await buy(driver1, new BN(1), brl(50_000), { standard: {} }, 30, "abc1d23");
    const p = await program.account.policy.fetch(policy1);
    const expected = quotePremium(brl(50_000), 100, 30);
    expect(p.premiumPaid.eq(expected)).to.be.true;
    expect(p.plate).to.eq("ABC1D23");
    expect(p.deductible.eq(brl(2_500))).to.be.true;
    expect(p.cashbackAmount.eq(expected.muln(2000).divn(10_000))).to.be.true;
    expect(before.sub(await balance(driver1.publicKey)).eq(expected)).to.be.true;

    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.totalActiveCoverage.eq(brl(50_000))).to.be.true;
    expect(pool.activePolicies.toNumber()).to.eq(1);
  });

  it("plano basico nao cobre colisao", async () => {
    policy2 = await buy(driver2, new BN(1), brl(40_000), { basic: {} }, 30, "XYZ9A87");
    await expectError(fileClaim(driver2, policy2, 0, { collision: {} }, brl(1_000)), "ClaimTypeNotCovered");
  });

  it("sinistro aprovado por quorum e pago descontando a franquia", async () => {
    const claim = await fileClaim(driver1, policy1, 0, { collision: {} }, brl(10_000));
    await expectError(fileClaim(driver1, policy1, 1, { theft: {} }, brl(1_000)), "ClaimAlreadyOpen");
    await expectError(vote(outsider, policy1, claim, true), "NotAssessor");

    await vote(assessors[0], policy1, claim, true);
    await expectError(vote(assessors[0], policy1, claim, true), "AlreadyVoted");
    await vote(assessors[1], policy1, claim, true);

    let c = await program.account.claim.fetch(claim);
    expect(c.status).to.have.property("approved");

    const before = await balance(driver1.publicKey);
    await program.methods
      .payClaim()
      .accountsPartial({
        payer: outsider.publicKey,
        pool: poolPda,
        stableMint: mintPda,
        vault: vaultPda,
        policy: policy1,
        claim,
        claimant: driver1.publicKey,
      })
      .signers([outsider])
      .rpc();
    const received = (await balance(driver1.publicKey)).sub(before);
    expect(received.eq(brl(7_500))).to.be.true;

    c = await program.account.claim.fetch(claim);
    expect(c.status).to.have.property("paid");
    const p = await program.account.policy.fetch(policy1);
    expect(p.hadPaidClaim).to.be.true;
    expect(p.hasOpenClaim).to.be.false;
    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.pendingClaims.toNumber()).to.eq(0);
    // cashback da apolice 1 foi revertido ao pool; so resta o da apolice 2
    const p2 = await program.account.policy.fetch(policy2);
    expect(pool.reservedCashback.eq(p2.cashbackAmount)).to.be.true;
  });

  it("sinistro rejeitado pelos avaliadores libera a apolice", async () => {
    policy3 = await buy(driver3, new BN(7), brl(30_000), { premium: {} }, 30, "QWE4R56");
    const claim = await fileClaim(driver3, policy3, 0, { thirdParty: {} }, brl(5_000));
    await vote(assessors[0], policy3, claim, false);
    await vote(assessors[2], policy3, claim, false);
    const c = await program.account.claim.fetch(claim);
    expect(c.status).to.have.property("rejected");
    const p = await program.account.policy.fetch(policy3);
    expect(p.hasOpenClaim).to.be.false;
    await expectError(
      program.methods
        .payClaim()
        .accountsPartial({
          payer: driver3.publicKey,
          pool: poolPda,
          stableMint: mintPda,
          vault: vaultPda,
          policy: policy3,
          claim,
          claimant: driver3.publicKey,
        })
        .signers([driver3])
        .rpc(),
      "ClaimNotApproved",
    );
  });

  it("nao permite liquidar apolice vigente nem sacar abaixo do colateral", async () => {
    await expectError(
      program.methods
        .settlePolicy()
        .accountsPartial({
          payer: driver2.publicKey,
          pool: poolPda,
          stableMint: mintPda,
          vault: vaultPda,
          policy: policy2,
          owner: driver2.publicKey,
        })
        .signers([driver2])
        .rpc(),
      "PolicyStillActive",
    );
    const pos = await program.account.stakePosition.fetch(
      PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), poolPda.toBuffer(), lp.publicKey.toBuffer()],
        pid,
      )[0],
    );
    await expectError(
      program.methods
        .withdrawLiquidity(pos.shares)
        .accountsPartial({
          owner: lp.publicKey,
          pool: poolPda,
          stableMint: mintPda,
          vault: vaultPda,
          ownerToken: ata(lp.publicKey),
        })
        .signers([lp])
        .rpc(),
      "WithdrawBreaksSolvency",
    );
  });

  it("apos a vigencia, motorista sem sinistro recebe cashback", async () => {
    const p2 = await program.account.policy.fetch(policy2);
    const p3 = await program.account.policy.fetch(policy3);
    // espera o relogio do cluster passar do fim da apolice mais recente
    const latestEnd = Math.max(p2.endTs.toNumber(), p3.endTs.toNumber());
    for (;;) {
      const slot = await provider.connection.getSlot();
      const now = await provider.connection.getBlockTime(slot);
      if (now && now > latestEnd + 1) break;
      await sleep(1000);
    }

    const before = await balance(driver2.publicKey);
    const settle = (policy: PublicKey, owner: PublicKey) =>
      program.methods
        .settlePolicy()
        .accountsPartial({
          payer: outsider.publicKey,
          pool: poolPda,
          stableMint: mintPda,
          vault: vaultPda,
          policy,
          owner,
        })
        .signers([outsider])
        .rpc();

    await settle(policy2, driver2.publicKey);
    const got = (await balance(driver2.publicKey)).sub(before);
    expect(got.eq(p2.cashbackAmount)).to.be.true;
    expect(got.gtn(0)).to.be.true;

    const before1 = await balance(driver1.publicKey);
    await settle(policy1, driver1.publicKey);
    expect((await balance(driver1.publicKey)).eq(before1)).to.be.true;

    await settle(policy3, driver3.publicKey);

    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.activePolicies.toNumber()).to.eq(0);
    expect(pool.totalActiveCoverage.toNumber()).to.eq(0);
    expect(pool.reservedCashback.toNumber()).to.eq(0);
    await expectError(settle(policy2, driver2.publicKey), "PolicyNotActive");
  });

  it("provedor de liquidez saca tudo; cofre fica zerado", async () => {
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), poolPda.toBuffer(), lp.publicKey.toBuffer()],
      pid,
    );
    const pos = await program.account.stakePosition.fetch(position);
    const vault = await vaultBalance();
    const before = await balance(lp.publicKey);
    await program.methods
      .withdrawLiquidity(pos.shares)
      .accountsPartial({
        owner: lp.publicKey,
        pool: poolPda,
        stableMint: mintPda,
        vault: vaultPda,
        ownerToken: ata(lp.publicKey),
      })
      .signers([lp])
      .rpc();
    expect((await balance(lp.publicKey)).sub(before).eq(vault)).to.be.true;
    expect((await vaultBalance()).toNumber()).to.eq(0);
  });

  it("somente a autoridade altera parametros", async () => {
    await expectError(
      program.methods
        .setPaused(true)
        .accountsPartial({ authority: outsider.publicKey, pool: poolPda })
        .signers([outsider])
        .rpc(),
      "Unauthorized",
    );
    await program.methods.setPaused(true).accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
    await expectError(buy(driver1, new BN(50), brl(10_000), { basic: {} }, 30, "AAA0A00"), "Paused");
    await program.methods.setPaused(false).accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
  });
});
