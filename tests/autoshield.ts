import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { expect } from "chai";
import { Autoshield } from "../target/types/autoshield";

const UNIT = 1_000_000; // 6 casas decimais
const brl = (v: number) => new BN(Math.round(v * UNIT));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEAD_SHARES = new BN(1_000_000);
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

// Parametros de teste: 1 "dia" de apolice = 1 segundo.
const PARAMS = {
  baseRateBps: 350,
  cashbackBps: 2000,
  protocolFeeBps: 500,
  minCollateralBps: 1000,
  withdrawCooldownSecs: new BN(0),
  claimVotingSecs: new BN(20),
  secondsPerDay: new BN(1),
  claimWaitingSecs: new BN(6),
  installmentGraceSecs: new BN(2),
  governanceDelaySecs: new BN(3),
  inspectionFee: brl(50),
  voteReward: brl(10),
  minVehicleValue: brl(5_000),
  inspectionThreshold: 2,
  withdrawNoticeSecs: new BN(2),
  maxPolicyCoverageBps: 60_000,
  faucetEnabled: true,
};

type Tier = { basic: {} } | { standard: {} } | { premium: {} };

function quotePremium(value: BN, tierMult: number, days: number): BN {
  return value
    .mul(new BN(PARAMS.baseRateBps))
    .mul(new BN(tierMult))
    .mul(new BN(days))
    .div(new BN(10_000 * 100 * 365));
}
const bps = (v: BN, b: number) => v.muln(b).divn(10_000);

const normalizePlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");
const plateHash = (p: string) => [...createHash("sha256").update(normalizePlate(p)).digest()];

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
  const conn = provider.connection;

  const [poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool")], pid);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), poolPda.toBuffer()], pid);
  const [mintPda] = PublicKey.findProgramAddressSync([Buffer.from("test_mint")], pid);
  const [programData] = PublicKey.findProgramAddressSync([pid.toBuffer()], UPGRADEABLE_LOADER);

  const admin = provider.wallet as anchor.Wallet;
  const lp = Keypair.generate();
  const driver1 = Keypair.generate();
  const driver2 = Keypair.generate();
  const driver3 = Keypair.generate();
  const driver4 = Keypair.generate();
  const driver5 = Keypair.generate();
  const squatter = Keypair.generate();
  const assessors = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const outsider = Keypair.generate();
  const newAdmin = Keypair.generate();

  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mintPda, owner);
  const balance = async (owner: PublicKey) => {
    try {
      return new BN((await getAccount(conn, ata(owner))).amount.toString());
    } catch {
      return new BN(0);
    }
  };
  const vaultBalance = async () => new BN((await getAccount(conn, vaultPda)).amount.toString());
  const pool = () => program.account.pool.fetch(poolPda);
  const tokenAccts = { pool: poolPda, stableMint: mintPda, vault: vaultPda };

  const policyPda = (owner: PublicKey, nonce: BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), owner.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
      pid,
    )[0];
  const vehiclePdaFromHash = (hash: number[] | Uint8Array) =>
    PublicKey.findProgramAddressSync([Buffer.from("vehicle"), Buffer.from(hash)], pid)[0];
  const vehiclePda = (plate: string) => vehiclePdaFromHash(plateHash(plate));
  const claimPda = (policy: PublicKey, index: number) =>
    PublicKey.findProgramAddressSync([Buffer.from("claim"), policy.toBuffer(), Buffer.from([index])], pid)[0];
  const stakePda = (owner: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("stake"), poolPda.toBuffer(), owner.toBuffer()], pid)[0];

  async function airdrop(pk: PublicKey) {
    const sig = await conn.requestAirdrop(pk, 5 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  }

  async function clusterNow() {
    return (await conn.getBlockTime(await conn.getSlot())) ?? 0;
  }
  async function waitUntil(ts: number) {
    while ((await clusterNow()) <= ts) await sleep(500);
  }

  const faucet = (k: Keypair, amount: BN) =>
    program.methods.faucet(amount).accounts({ user: k.publicKey }).signers([k]).rpc();

  async function buy(
    driver: Keypair,
    nonce: number,
    value: BN,
    tier: Tier,
    days: number,
    plate: string,
    installments = 1,
  ) {
    const n = new BN(nonce);
    const policy = policyPda(driver.publicKey, n);
    await program.methods
      .purchasePolicy({
        nonce: n,
        plateHash: plateHash(plate),
        model: "VW Gol 1.0",
        year: 2020,
        vehicleValue: value,
        tier: tier as any,
        durationDays: days,
        installments,
        maxPremium: value,
      })
      .accountsPartial({
        owner: driver.publicKey,
        ...tokenAccts,
        ownerToken: ata(driver.publicKey),
        policy,
        vehicle: vehiclePda(plate),
      })
      .signers([driver])
      .rpc();
    return policy;
  }

  async function inspect(assessor: Keypair, policy: PublicKey, approve: boolean) {
    const p = await program.account.policy.fetch(policy);
    await program.methods
      .inspectPolicy(approve)
      .accountsPartial({
        assessor: assessor.publicKey,
        ...tokenAccts,
        policy,
        vehicle: vehiclePdaFromHash(p.plateHash),
        owner: p.owner,
      })
      .signers([assessor])
      .rpc();
  }

  /** Vistoria por quorum (2 de 3): aprova ou recusa com dois avaliadores. */
  async function inspectBy(voters: Keypair[], policy: PublicKey, approve: boolean) {
    for (const v of voters) await inspect(v, policy, approve);
  }

  async function fileClaim(driver: Keypair, policy: PublicKey, index: number, kind: object, amount: BN) {
    const claim = claimPda(policy, index);
    await program.methods
      .fileClaim({ kind: kind as any, amount, description: "Colisao traseira no semaforo", evidenceUri: "sha256:abc123" })
      .accountsPartial({ owner: driver.publicKey, pool: poolPda, policy, claim })
      .signers([driver])
      .rpc();
    return claim;
  }

  const vote = (assessor: Keypair, policy: PublicKey, claim: PublicKey, approve: boolean, reclassify: object | null = null) =>
    program.methods
      .voteClaim(approve, reclassify as any)
      .accountsPartial({ assessor: assessor.publicKey, ...tokenAccts, policy, claim })
      .signers([assessor])
      .rpc();

  const payClaim = (payer: Keypair, policy: PublicKey, claim: PublicKey, claimant: PublicKey) =>
    program.methods
      .payClaim()
      .accountsPartial({ payer: payer.publicKey, ...tokenAccts, policy, claim, claimant })
      .signers([payer])
      .rpc();

  async function settle(policy: PublicKey) {
    const p = await program.account.policy.fetch(policy);
    await program.methods
      .settlePolicy()
      .accountsPartial({
        payer: outsider.publicKey,
        ...tokenAccts,
        policy,
        vehicle: vehiclePdaFromHash(p.plateHash),
        owner: p.owner,
      })
      .signers([outsider])
      .rpc();
  }

  const payInstallment = (driver: Keypair, policy: PublicKey) =>
    program.methods
      .payInstallment()
      .accountsPartial({ owner: driver.publicKey, ...tokenAccts, ownerToken: ata(driver.publicKey), policy })
      .signers([driver])
      .rpc();

  const deposit = (k: Keypair, amount: BN) =>
    program.methods
      .depositLiquidity(amount)
      .accountsPartial({ owner: k.publicKey, ...tokenAccts, ownerToken: ata(k.publicKey) })
      .signers([k])
      .rpc();

  const requestWithdraw = (k: Keypair, shares: BN) =>
    program.methods
      .requestWithdrawal(shares)
      .accountsPartial({ owner: k.publicKey, pool: poolPda, position: stakePda(k.publicKey) })
      .signers([k])
      .rpc();

  const withdraw = (k: Keypair, shares: BN) =>
    program.methods
      .withdrawLiquidity(shares)
      .accountsPartial({ owner: k.publicKey, ...tokenAccts, ownerToken: ata(k.publicKey) })
      .signers([k])
      .rpc();

  const initPool = (authority: PublicKey, signers: Keypair[] = []) =>
    program.methods
      .initializePool(
        PARAMS,
        assessors.map((a) => a.publicKey),
        2,
      )
      .accountsPartial({ authority, stableMint: mintPda, program: pid, programData })
      .signers(signers)
      .rpc();

  let policy1: PublicKey; // driver1, Essencial a vista, 60 dias -> sinistro aprovado
  let policy2: PublicKey; // driver2, Basico a vista, 30 dias -> cashback
  let policy3: PublicKey; // driver3, Completo, 60 dias -> sinistro recusado
  let ownPolicy: PublicKey; // avaliador 2 como motorista
  let bigPolicy: PublicKey; // driver4, sinistro maior que a liquidez
  let monthly: PublicKey; // driver5, 12x em 360 dias (segue ativa ate o fim)

  before(async () => {
    await Promise.all(
      [lp, driver1, driver2, driver3, driver4, driver5, squatter, outsider, newAdmin, ...assessors].map((k) =>
        airdrop(k.publicKey),
      ),
    );
  });

  describe("inicializacao e liquidez", () => {
    it("somente a autoridade de upgrade inicializa o pool", async () => {
      await program.methods.initTestMint().accounts({ payer: admin.publicKey }).rpc();
      await expectError(initPool(outsider.publicKey, [outsider]), "Unauthorized");
      await initPool(admin.publicKey);
      const p = await pool();
      expect(p.authority.toBase58()).to.eq(admin.publicKey.toBase58());
      expect(p.version).to.eq(1);
      expect(p.params.protocolFeeBps).to.eq(500);
    });

    it("faucet distribui tBRL e respeita o limite", async () => {
      for (const k of [lp, driver1, driver2, driver3, driver4, driver5, squatter, assessors[2]]) {
        await faucet(k, brl(150_000));
      }
      await expectError(faucet(outsider, brl(200_001)), "FaucetLimit");
    });

    it("recusa apolice sem capital suficiente no pool", async () => {
      await expectError(buy(driver1, 99, brl(50_000), { standard: {} }, 30, "ZZZ9Z99"), "InsufficientPoolCapital");
    });

    it("primeiro aporte tem minimo e gera cotas mortas (anti-inflacao)", async () => {
      await expectError(deposit(lp, brl(99)), "FirstDepositTooSmall");
      await deposit(lp, brl(100_000));
      const p = await pool();
      expect(p.totalShares.eq(brl(100_000))).to.be.true;
      const pos = await program.account.stakePosition.fetch(stakePda(lp.publicKey));
      expect(pos.shares.eq(brl(100_000).sub(DEAD_SHARES))).to.be.true;
    });
  });

  describe("apolices, taxas e vistoria", () => {
    it("contratacao a vista separa taxa do protocolo, cashback e taxa de vistoria", async () => {
      const before = await balance(driver1.publicKey);
      const poolBefore = await pool();
      policy1 = await buy(driver1, 1, brl(50_000), { standard: {} }, 60, "abc1d23");
      const p = await program.account.policy.fetch(policy1);
      const premium = quotePremium(brl(50_000), 100, 60);
      expect(p.premiumTotal.eq(premium)).to.be.true;
      expect(p.premiumPaid.eq(premium)).to.be.true;
      expect(p.installments).to.eq(1);
      // a placa nunca vai em texto para a blockchain (so o hash)
      const raw = (await conn.getAccountInfo(policy1))!.data.toString("latin1");
      expect(raw).to.not.contain("ABC1D23");
      expect(Buffer.from(p.plateHash).equals(Buffer.from(plateHash("ABC1D23")))).to.be.true;
      expect(p.cashbackAmount.eq(bps(premium, 2000))).to.be.true;
      expect(p.protocolFeesPaid.eq(bps(premium, 500))).to.be.true;
      expect(before.sub(await balance(driver1.publicKey)).eq(premium.add(brl(50)))).to.be.true;
      const pl = await pool();
      expect(pl.treasuryAccrued.sub(poolBefore.treasuryAccrued).eq(bps(premium, 500))).to.be.true;
      expect(pl.pendingInspectionFees.eq(brl(50))).to.be.true;
      // placa ainda nao travada: a trava so acontece na vistoria aprovada
      const vehicle = await program.account.vehicleRecord.fetch(vehiclePda("ABC1D23"));
      expect(vehicle.activePolicy.toBase58()).to.eq(PublicKey.default.toBase58());
    });

    it("recusa valor de veiculo abaixo do minimo e hash de placa vazio", async () => {
      await expectError(buy(driver2, 50, brl(4_000), { basic: {} }, 30, "MIN0A00"), "InvalidVehicleValue");
      const zero = new Array(32).fill(0);
      const policy = policyPda(driver2.publicKey, new BN(6));
      await expectError(
        program.methods
          .purchasePolicy({
            nonce: new BN(6),
            plateHash: zero,
            model: "Fraude",
            year: 2020,
            vehicleValue: brl(10_000),
            tier: { basic: {} } as any,
            durationDays: 30,
            installments: 1,
            maxPremium: brl(10_000),
          })
          .accountsPartial({
            owner: driver2.publicKey,
            ...tokenAccts,
            ownerToken: ata(driver2.publicKey),
            policy,
            vehicle: vehiclePdaFromHash(zero),
          })
          .signers([driver2])
          .rpc(),
        "PlateHashMismatch",
      );
    });

    it("placa de terceiro nao bloqueia o dono; golpista perde a taxa de vistoria", async () => {
      const squatterBefore = await balance(squatter.publicKey);
      const fake = await buy(squatter, 1, brl(5_000), { basic: {} }, 30, "abc-1d23");
      const assessorBefore = await balance(assessors[1].publicKey);
      // dono real vistoriado primeiro por quorum (2 de 3): trava a placa
      await inspect(assessors[0], policy1, true);
      expect((await program.account.vehicleRecord.fetch(vehiclePda("ABC1D23"))).activePolicy.toBase58()).to.eq(
        PublicKey.default.toBase58(),
      );
      await expectError(inspect(assessors[0], policy1, true), "AlreadyVoted");
      await inspect(assessors[1], policy1, true);
      const vehicle = await program.account.vehicleRecord.fetch(vehiclePda("ABC1D23"));
      expect(vehicle.activePolicy.toBase58()).to.eq(policy1.toBase58());
      // o golpista e recusado pelo quorum; recebe de volta so o premio
      await inspect(assessors[1], fake, false);
      await inspect(assessors[2], fake, false);
      expect(squatterBefore.sub(await balance(squatter.publicKey)).eq(brl(50))).to.be.true;
      // cada voto recebe metade da taxa de vistoria (taxa / quorum)
      expect((await balance(assessors[1].publicKey)).sub(assessorBefore).eq(brl(50))).to.be.true;
      expect((await program.account.policy.fetch(fake)).status).to.have.property("cancelled");
      // com a placa travada, nova contratacao e recusada de cara
      await expectError(buy(squatter, 2, brl(5_000), { basic: {} }, 30, "ABC1D23"), "VehicleAlreadyInsured");
    });

    it("sinistro exige vistoria e respeita a carencia", async () => {
      policy2 = await buy(driver2, 1, brl(40_000), { basic: {} }, 30, "XYZ9A87");
      await expectError(fileClaim(driver2, policy2, 0, { theft: {} }, brl(1_000)), "PolicyNotInspected");
      await expectError(inspect(outsider, policy2, true), "NotAssessor");
      await inspectBy([assessors[0], assessors[1]], policy2, true);
      await expectError(inspect(assessors[2], policy2, true), "AlreadyInspected");
      await expectError(fileClaim(driver2, policy2, 0, { theft: {} }, brl(1_000)), "ClaimWaitingPeriod");
      const p2 = await program.account.policy.fetch(policy2);
      await waitUntil(p2.claimsAllowedFrom.toNumber());
      await expectError(fileClaim(driver2, policy2, 0, { collision: {} }, brl(1_000)), "ClaimTypeNotCovered");
    });
  });

  describe("sinistros e remuneracao de avaliadores", () => {
    it("sinistro aprovado por quorum paga franquia descontada e remunera os votos", async () => {
      const claim = await fileClaim(driver1, policy1, 0, { collision: {} }, brl(10_000));
      await expectError(fileClaim(driver1, policy1, 1, { theft: {} }, brl(1_000)), "ClaimAlreadyOpen");
      await expectError(vote(outsider, policy1, claim, true), "NotAssessor");

      const a0 = await balance(assessors[0].publicKey);
      const treasuryBefore = (await pool()).treasuryAccrued;
      await vote(assessors[0], policy1, claim, true);
      await expectError(vote(assessors[0], policy1, claim, true), "AlreadyVoted");
      await vote(assessors[1], policy1, claim, true);
      expect((await balance(assessors[0].publicKey)).sub(a0).eq(brl(10))).to.be.true;
      // cada voto recebe ate vote_reward, limitado ao saldo da tesouraria
      const expectedRewards = BN.min(brl(20), treasuryBefore);
      expect(treasuryBefore.sub((await pool()).treasuryAccrued).eq(expectedRewards)).to.be.true;

      const before = await balance(driver1.publicKey);
      await payClaim(outsider, policy1, claim, driver1.publicKey);
      expect((await balance(driver1.publicKey)).sub(before).eq(brl(7_500))).to.be.true;
      const p = await program.account.policy.fetch(policy1);
      expect(p.hadPaidClaim).to.be.true;
      expect(p.cashbackAmount.toNumber()).to.eq(0);
      expect((await program.account.claim.fetch(claim)).status).to.have.property("paid");
    });

    it("sinistro rejeitado pelos avaliadores libera a apolice", async () => {
      policy3 = await buy(driver3, 7, brl(30_000), { premium: {} }, 60, "QWE4R56");
      await inspectBy([assessors[1], assessors[2]], policy3, true);
      await waitUntil((await program.account.policy.fetch(policy3)).claimsAllowedFrom.toNumber());
      const claim = await fileClaim(driver3, policy3, 0, { thirdParty: {} }, brl(5_000));
      await vote(assessors[0], policy3, claim, false);
      await vote(assessors[2], policy3, claim, false);
      expect((await program.account.claim.fetch(claim)).status).to.have.property("rejected");
      expect((await program.account.policy.fetch(policy3)).hasOpenClaim).to.be.false;
      await expectError(payClaim(driver3, policy3, claim, driver3.publicKey), "ClaimNotApproved");
    });

    it("avaliador reclassifica roubo declarado como colisao e a franquia e aplicada", async () => {
      const claim = await fileClaim(driver3, policy3, 1, { theft: {} }, brl(5_000));
      await vote(assessors[0], policy3, claim, true, { collision: {} });
      await vote(assessors[2], policy3, claim, true, { collision: {} });
      const c = await program.account.claim.fetch(claim);
      expect(c.kind).to.have.property("collision");
      expect(c.originalKind).to.have.property("theft");
      expect(c.reclassified).to.be.true;
      const before = await balance(driver3.publicKey);
      await payClaim(outsider, policy3, claim, driver3.publicKey);
      // franquia de 5% sobre 30.000 = 1.500
      expect((await balance(driver3.publicKey)).sub(before).eq(brl(3_500))).to.be.true;
    });

    it("avaliador nao vota nem vistoria a propria apolice", async () => {
      ownPolicy = await buy(assessors[2], 1, brl(20_000), { premium: {} }, 60, "AVL1A11");
      await expectError(inspect(assessors[2], ownPolicy, true), "AssessorConflict");
      await inspectBy([assessors[0], assessors[1]], ownPolicy, true);
      await waitUntil((await program.account.policy.fetch(ownPolicy)).claimsAllowedFrom.toNumber());
      const claim = await fileClaim(assessors[2], ownPolicy, 0, { theft: {} }, brl(20_000));
      await expectError(vote(assessors[2], ownPolicy, claim, true), "AssessorConflict");
      await vote(assessors[0], ownPolicy, claim, false);
      await vote(assessors[1], ownPolicy, claim, false);
    });

    it("sinistro maior que a liquidez livre nao e pago pela metade", async () => {
      await expectError(buy(driver4, 9, brl(700_000), { basic: {} }, 60, "EXP0A00"), "ExposureLimit");
      bigPolicy = await buy(driver4, 1, brl(500_000), { basic: {} }, 60, "BIG0A00");
      await inspectBy([assessors[0], assessors[1]], bigPolicy, true);
      await waitUntil((await program.account.policy.fetch(bigPolicy)).claimsAllowedFrom.toNumber());
      const claim = await fileClaim(driver4, bigPolicy, 0, { theft: {} }, brl(400_000));
      await vote(assessors[0], bigPolicy, claim, true);
      await vote(assessors[1], bigPolicy, claim, true);
      const reservedBefore = (await pool()).reservedCashback;
      await expectError(payClaim(driver4, bigPolicy, claim, driver4.publicKey), "InsufficientLiquidityForClaim");
      expect((await program.account.claim.fetch(claim)).status).to.have.property("approved");
      // novos aportes cobrem o sinistro; cashback reservado de terceiros fica intacto
      await faucet(lp, brl(200_000));
      await faucet(lp, brl(200_000));
      await deposit(lp, brl(400_000));
      const before = await balance(driver4.publicKey);
      await payClaim(driver4, bigPolicy, claim, driver4.publicKey);
      expect((await balance(driver4.publicKey)).sub(before).eq(brl(400_000))).to.be.true;
      const p = await pool();
      expect(p.reservedCashback.lte(reservedBefore)).to.be.true;
      expect(p.pendingClaims.toNumber()).to.eq(0);
    });
  });

  describe("pagamento parcelado", () => {
    let lapsing: PublicKey;

    it("contrata em 12x cobrando so a primeira parcela", async () => {
      const before = await balance(driver5.publicKey);
      monthly = await buy(driver5, 1, brl(60_000), { standard: {} }, 360, "PAR1C12", 12);
      const p = await program.account.policy.fetch(monthly);
      const total = quotePremium(brl(60_000), 100, 360);
      const first = total.divn(12);
      expect(p.premiumTotal.eq(total)).to.be.true;
      expect(p.premiumPaid.eq(first)).to.be.true;
      expect(p.installmentsPaid).to.eq(1);
      expect(before.sub(await balance(driver5.publicKey)).eq(first.add(brl(50)))).to.be.true;
      expect(p.cashbackAmount.eq(bps(first, 2000))).to.be.true;
      await expectError(buy(driver5, 2, brl(60_000), { standard: {} }, 300, "PAR2C12", 12), "InvalidInstallments");
    });

    it("pagar parcela estende a cobertura paga", async () => {
      const p0 = await program.account.policy.fetch(monthly);
      await payInstallment(driver5, monthly);
      const p = await program.account.policy.fetch(monthly);
      expect(p.installmentsPaid).to.eq(2);
      expect(p.premiumPaid.eq(p0.premiumPaid.mul(new BN(2)))).to.be.true;
    });

    it("parcela em atraso faz a apolice caducar: sem sinistro, sem pagamento tardio, sem cashback", async () => {
      lapsing = await buy(driver5, 3, brl(30_000), { standard: {} }, 60, "LAP5E00", 2);
      await inspectBy([assessors[0], assessors[1]], lapsing, true);
      const p = await program.account.policy.fetch(lapsing);
      const paidUntil = p.startTs.toNumber() + p.installmentPeriod.toNumber();
      await waitUntil(paidUntil);
      await expectError(fileClaim(driver5, lapsing, 0, { collision: {} }, brl(1_000)), "PolicyLapsed");
      await waitUntil(paidUntil + PARAMS.installmentGraceSecs.toNumber());
      await expectError(payInstallment(driver5, lapsing), "PolicyLapsed");
      const reservedBefore = (await pool()).reservedCashback;
      const coverageBefore = (await pool()).totalActiveCoverage;
      await settle(lapsing);
      const after = await pool();
      expect(reservedBefore.sub(after.reservedCashback).eq(p.cashbackAmount)).to.be.true;
      expect(coverageBefore.sub(after.totalActiveCoverage).eq(p.coverageLimit)).to.be.true;
      const settled = await program.account.policy.fetch(lapsing);
      expect(settled.cashbackRedeemed).to.be.false;
      // placa liberada para uma nova contratacao
      const vehicle = await program.account.vehicleRecord.fetch(vehiclePda("LAP5E00"));
      expect(vehicle.activePolicy.toBase58()).to.eq(PublicKey.default.toBase58());
    });
  });

  describe("governanca", () => {
    it("parametros so mudam apos o timelock", async () => {
      const next = { ...PARAMS, cashbackBps: 2500 };
      await expectError(
        program.methods.proposeParams(next).accountsPartial({ authority: outsider.publicKey, pool: poolPda }).signers([outsider]).rpc(),
        "Unauthorized",
      );
      await program.methods.proposeParams(next).accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
      const apply = () =>
        program.methods.applyParams().accountsPartial({ caller: outsider.publicKey, pool: poolPda }).signers([outsider]).rpc();
      await expectError(apply(), "TimelockActive");
      await waitUntil((await pool()).pendingParamsEta.toNumber());
      await apply();
      expect((await pool()).params.cashbackBps).to.eq(2500);
      await expectError(apply(), "NoPendingChange");
    });

    it("troca de avaliadores tem timelock e pode ser cancelada", async () => {
      await program.methods
        .proposeAssessors([outsider.publicKey], 1)
        .accountsPartial({ authority: admin.publicKey, pool: poolPda })
        .rpc();
      const apply = () =>
        program.methods.applyAssessors().accountsPartial({ caller: outsider.publicKey, pool: poolPda }).signers([outsider]).rpc();
      await expectError(apply(), "TimelockActive");
      await program.methods.cancelPending().accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
      await expectError(apply(), "NoPendingChange");
      expect((await pool()).assessors.length).to.eq(3);
    });

    it("autoridade e transferida em dois passos", async () => {
      await program.methods
        .proposeAuthority(newAdmin.publicKey)
        .accountsPartial({ authority: admin.publicKey, pool: poolPda })
        .rpc();
      await expectError(
        program.methods.acceptAuthority().accountsPartial({ newAuthority: outsider.publicKey, pool: poolPda }).signers([outsider]).rpc(),
        "NotPendingAuthority",
      );
      await program.methods.acceptAuthority().accountsPartial({ newAuthority: newAdmin.publicKey, pool: poolPda }).signers([newAdmin]).rpc();
      expect((await pool()).authority.toBase58()).to.eq(newAdmin.publicKey.toBase58());
      // devolve para o admin original
      await program.methods
        .proposeAuthority(admin.publicKey)
        .accountsPartial({ authority: newAdmin.publicKey, pool: poolPda })
        .signers([newAdmin])
        .rpc();
      await program.methods.acceptAuthority().accountsPartial({ newAuthority: admin.publicKey, pool: poolPda }).rpc();
    });

    it("tesouraria so e sacada pela autoridade e ate o valor acumulado", async () => {
      const accrued = (await pool()).treasuryAccrued;
      expect(accrued.gtn(0)).to.be.true;
      const dest = ata(admin.publicKey);
      await faucet(newAdmin, brl(1)); // garante contas de token existentes
      await program.methods.faucet(brl(1)).accounts({ user: admin.publicKey }).rpc();
      const w = (auth: PublicKey, amount: BN, signers: Keypair[] = []) =>
        program.methods
          .withdrawTreasury(amount)
          .accountsPartial({ authority: auth, ...tokenAccts, destination: dest })
          .signers(signers)
          .rpc();
      await expectError(w(outsider.publicKey, brl(1), [outsider]), "Unauthorized");
      await expectError(w(admin.publicKey, accrued.addn(1)), "InsufficientTreasury");
      const before = await balance(admin.publicKey);
      await w(admin.publicKey, accrued);
      expect((await balance(admin.publicKey)).sub(before).eq(accrued)).to.be.true;
      expect((await pool()).treasuryAccrued.toNumber()).to.eq(0);
    });

    it("pausa bloqueia contratacoes", async () => {
      await expectError(
        program.methods.setPaused(true).accountsPartial({ authority: outsider.publicKey, pool: poolPda }).signers([outsider]).rpc(),
        "Unauthorized",
      );
      await program.methods.setPaused(true).accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
      await expectError(buy(driver1, 50, brl(10_000), { basic: {} }, 30, "AAA0A00"), "Paused");
      await program.methods.setPaused(false).accountsPartial({ authority: admin.publicKey, pool: poolPda }).rpc();
    });
  });

  describe("encerramento", () => {
    it("liquidar exige fim da vigencia; sem sinistro devolve o cashback", async () => {
      await expectError(settle(monthly), "PolicyStillActive");
      const p2 = await program.account.policy.fetch(policy2);
      await waitUntil(p2.endTs.toNumber());
      const before = await balance(driver2.publicKey);
      await settle(policy2);
      expect((await balance(driver2.publicKey)).sub(before).eq(p2.cashbackAmount)).to.be.true;
      expect(p2.cashbackAmount.gtn(0)).to.be.true;
      await expectError(settle(policy2), "PolicyNotActive");
    });

    it("encerra as demais apolices e o LP saca o excedente, restando as cotas mortas", async () => {
      const ends = await Promise.all(
        [policy1, policy3, ownPolicy, bigPolicy].map(async (p) => (await program.account.policy.fetch(p)).endTs.toNumber()),
      );
      await waitUntil(Math.max(...ends));
      for (const p of [policy1, policy3, ownPolicy, bigPolicy]) await settle(p);
      const freed = await program.account.vehicleRecord.fetch(vehiclePda("ABC1D23"));
      expect(freed.activePolicy.toBase58()).to.eq(PublicKey.default.toBase58());

      // apolice parcelada de 360 dias continua ativa: o LP saca somente o excedente
      const pos = await program.account.stakePosition.fetch(stakePda(lp.publicKey));
      await expectError(withdraw(lp, pos.shares), "WithdrawNotRequested");
      await requestWithdraw(lp, pos.shares);
      await sleep(3000);
      await expectError(withdraw(lp, pos.shares), "WithdrawBreaksSolvency");
      const p = await pool();
      const nav = (await vaultBalance()).sub(p.reservedCashback).sub(p.treasuryAccrued).sub(p.pendingInspectionFees);
      const required = p.totalActiveCoverage.muln(1000).divn(10_000).add(p.pendingClaims);
      const freeShares = nav.sub(required).mul(p.totalShares).div(nav).subn(1);
      // novo pedido substitui o anterior e reinicia o aviso previo
      await requestWithdraw(lp, freeShares);
      await expectError(withdraw(lp, freeShares), "WithdrawNoticeActive");
      await sleep(3000);
      await withdraw(lp, freeShares);
      expect((await pool()).totalShares.gte(DEAD_SHARES)).to.be.true;
    });

    it("fecha contas encerradas e devolve o aluguel em SOL", async () => {
      const claim0 = claimPda(policy1, 0);
      const before = await conn.getBalance(driver1.publicKey);
      await program.methods
        .closeClaim()
        .accountsPartial({ caller: outsider.publicKey, claim: claim0, claimant: driver1.publicKey })
        .signers([outsider])
        .rpc();
      await program.methods
        .closePolicy()
        .accountsPartial({ caller: outsider.publicKey, policy: policy1, owner: driver1.publicKey })
        .signers([outsider])
        .rpc();
      expect(await conn.getAccountInfo(policy1)).to.be.null;
      expect(await conn.getAccountInfo(claim0)).to.be.null;
      expect((await conn.getBalance(driver1.publicKey)) - before).to.be.greaterThan(0);
      // apolice ativa e posicao com cotas nao podem ser fechadas
      await expectError(
        program.methods
          .closePolicy()
          .accountsPartial({ caller: outsider.publicKey, policy: monthly, owner: driver5.publicKey })
          .signers([outsider])
          .rpc(),
        "AccountNotClosable",
      );
      await expectError(
        program.methods
          .closePosition()
          .accountsPartial({ owner: lp.publicKey, position: stakePda(lp.publicKey) })
          .signers([lp])
          .rpc(),
        "AccountNotClosable",
      );
    });
  });
});
