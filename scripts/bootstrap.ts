/**
 * Inicializa o AutoShieldFI em um cluster (localnet/devnet):
 *  1. cria o token de teste tBRL (mint PDA do programa)
 *  2. inicializa o pool de risco com os parametros abaixo
 *  3. emite tBRL via faucet e aporta a liquidez inicial
 *
 * Uso:  anchor run bootstrap --provider.cluster devnet
 * Variaveis opcionais:
 *   SECONDS_PER_DAY   duracao de 1 "dia" de apolice (padrao 86400; use 60 para demo acelerada)
 *   ASSESSORS         chaves publicas extras de avaliadores, separadas por virgula
 *   THRESHOLD         quorum de aprovacao (padrao: min(2, nº de avaliadores))
 *   SEED_LIQUIDITY    liquidez inicial em tBRL (padrao 500000)
 *   CLAIM_WAITING_SECS carencia para sinistros apos a contratacao (padrao 7 dias)
 *   PROTOCOL_FEE_BPS  taxa do protocolo sobre o premio (padrao 500 = 5%)
 *   INSPECTION_FEE    taxa de vistoria em tBRL, paga ao avaliador (padrao 50)
 *   VOTE_REWARD       remuneracao por voto em tBRL (padrao 10)
 *   MIN_VEHICLE_VALUE valor FIPE minimo em tBRL (padrao 5000)
 *   GOVERNANCE_DELAY_SECS timelock de governanca (padrao 1 dia)
 *   INSTALLMENT_GRACE_SECS tolerancia de atraso da parcela (padrao 5 dias)
 *
 * O pool so pode ser criado pela autoridade de upgrade do programa. Se ele ja
 * existir com outra autoridade, o script aborta sem depositar nada.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Autoshield } from "../target/types/autoshield";

const UNIT = 1_000_000;
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const env = (k: string, d: number) => Number(process.env[k] ?? d);
const FAUCET_MAX = 200_000;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.autoshield as Program<Autoshield>;
  const pid = program.programId;
  const admin = provider.wallet.publicKey;

  const [poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool")], pid);
  const [mintPda] = PublicKey.findProgramAddressSync([Buffer.from("test_mint")], pid);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), poolPda.toBuffer()], pid);

  console.log("Programa:", pid.toBase58());
  console.log("Admin:   ", admin.toBase58());

  if (!(await provider.connection.getAccountInfo(mintPda))) {
    await program.methods.initTestMint().accounts({ payer: admin }).rpc();
    console.log("tBRL mint criado:", mintPda.toBase58());
  } else {
    console.log("tBRL mint ja existe:", mintPda.toBase58());
  }

  const extra = (process.env.ASSESSORS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new PublicKey(s));
  const assessors = [admin, ...extra.filter((a) => !a.equals(admin))].slice(0, 5);
  const threshold = Number(process.env.THRESHOLD ?? Math.min(2, assessors.length));

  if (!(await provider.connection.getAccountInfo(poolPda))) {
    await program.methods
      .initializePool(
        {
          baseRateBps: 350,
          cashbackBps: 2000,
          protocolFeeBps: env("PROTOCOL_FEE_BPS", 500),
          minCollateralBps: 1000,
          withdrawCooldownSecs: new BN(Number(process.env.WITHDRAW_COOLDOWN ?? 0)),
          claimVotingSecs: new BN(Number(process.env.CLAIM_VOTING_SECS ?? 3 * 86400)),
          secondsPerDay: new BN(Number(process.env.SECONDS_PER_DAY ?? 86400)),
          claimWaitingSecs: new BN(Number(process.env.CLAIM_WAITING_SECS ?? 7 * 86400)),
          installmentGraceSecs: new BN(env("INSTALLMENT_GRACE_SECS", 5 * 86400)),
          governanceDelaySecs: new BN(env("GOVERNANCE_DELAY_SECS", 86400)),
          inspectionFee: new BN(env("INSPECTION_FEE", 50) * UNIT),
          voteReward: new BN(env("VOTE_REWARD", 10) * UNIT),
          minVehicleValue: new BN(env("MIN_VEHICLE_VALUE", 5000) * UNIT),
          faucetEnabled: true,
        },
        assessors,
        threshold,
      )
      .accountsPartial({
        authority: admin,
        stableMint: mintPda,
        program: pid,
        programData: PublicKey.findProgramAddressSync([pid.toBuffer()], UPGRADEABLE_LOADER)[0],
      })
      .rpc();
    console.log(`Pool criado: ${poolPda.toBase58()} (avaliadores: ${assessors.length}, quorum ${threshold})`);
  } else {
    const existing = await program.account.pool.fetch(poolPda);
    if (!existing.authority.equals(admin)) {
      throw new Error(
        `Pool ${poolPda.toBase58()} pertence a ${existing.authority.toBase58()}, nao a esta carteira. Abortando sem depositar.`,
      );
    }
    console.log("Pool ja existe (autoridade confere):", poolPda.toBase58());
  }

  const seed = Number(process.env.SEED_LIQUIDITY ?? 500_000);
  if (seed > 0) {
    let left = seed;
    while (left > 0) {
      const amt = Math.min(left, FAUCET_MAX);
      await program.methods.faucet(new BN(amt * UNIT)).accounts({ user: admin }).rpc();
      left -= amt;
    }
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    await program.methods
      .depositLiquidity(new BN(seed * UNIT))
      .accountsPartial({
        owner: admin,
        pool: poolPda,
        stableMint: mintPda,
        vault: vaultPda,
        ownerToken: getAssociatedTokenAddressSync(mintPda, admin),
      })
      .rpc();
    console.log(`Liquidez inicial aportada: ${seed.toLocaleString("pt-BR")} tBRL`);
  }

  const pool = await program.account.pool.fetch(poolPda);
  console.log("Cotas totais:", pool.totalShares.toString());
  console.log("Pronto! Configure NEXT_PUBLIC_PROGRAM_ID no app/.env.local e selecione o modo on-chain.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
