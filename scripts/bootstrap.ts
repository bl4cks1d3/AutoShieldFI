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
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Autoshield } from "../target/types/autoshield";

const UNIT = 1_000_000;
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
          minCollateralBps: 1000,
          withdrawCooldownSecs: new BN(Number(process.env.WITHDRAW_COOLDOWN ?? 0)),
          claimVotingSecs: new BN(Number(process.env.CLAIM_VOTING_SECS ?? 3 * 86400)),
          secondsPerDay: new BN(Number(process.env.SECONDS_PER_DAY ?? 86400)),
          faucetEnabled: true,
        },
        assessors,
        threshold,
      )
      .accountsPartial({ authority: admin, stableMint: mintPda })
      .rpc();
    console.log(`Pool criado: ${poolPda.toBase58()} (avaliadores: ${assessors.length}, quorum ${threshold})`);
  } else {
    console.log("Pool ja existe:", poolPda.toBase58());
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
