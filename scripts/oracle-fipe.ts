/**
 * Oraculo de precos FIPE: atualiza o valor das apolices ativas com o preco do
 * mes na tabela FIPE, para que a cobertura (e a indenizacao por perda total)
 * acompanhe a tabela. Rode mensalmente (cron) com a carteira do oraculo.
 *
 * Uso:
 *   ORACLE_KEYPAIR=~/.config/solana/oracle.json anchor run oracle --provider.cluster devnet
 * Antes, a autoridade do pool define o oraculo:
 *   program.methods.setOracle(<pubkey do oraculo>)
 *
 * Variaveis opcionais:
 *   FIPE_API_URL    padrao https://fipe.parallelum.com.br/api/v2
 *   FIPE_API_TOKEN  token da API FIPE v2 (aumenta o limite de consultas)
 *   DRY_RUN=1       so mostra o que mudaria, sem enviar transacoes
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";
import { Autoshield } from "../target/types/autoshield";

const UNIT = 1_000_000;
const MAX_CHANGE_BPS = 2_000; // espelho de MAX_FIPE_CHANGE_BPS no contrato
const FIPE = process.env.FIPE_API_URL ?? "https://fipe.parallelum.com.br/api/v2";
const DRY = process.env.DRY_RUN === "1";

async function fipePrice(code: string, year: string): Promise<number | null> {
  const headers: Record<string, string> = {};
  if (process.env.FIPE_API_TOKEN) headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;
  for (const type of ["cars", "motorcycles", "trucks"]) {
    const years = await fetch(`${FIPE}/${type}/${code}/years`, { headers });
    if (!years.ok) continue;
    const list = (await years.json()) as { code: string }[];
    const y = list.find((o) => o.code.startsWith(`${year}-`)) ?? list.find((o) => o.code.startsWith(year));
    if (!y) continue;
    const res = await fetch(`${FIPE}/${type}/${code}/years/${y.code}`, { headers });
    if (!res.ok) continue;
    const { price } = (await res.json()) as { price: string };
    const reais = Number(price.replace(/[^\d,]/g, "").replace(",", "."));
    return Number.isFinite(reais) && reais > 0 ? Math.round(reais * UNIT) : null;
  }
  return null;
}

/** Limita a variacao ao maximo aceito pelo contrato por atualizacao. */
function clamp(current: number, target: number): number {
  const max = Math.floor((current * (10_000 + MAX_CHANGE_BPS)) / 10_000);
  const min = Math.ceil((current * (10_000 - MAX_CHANGE_BPS)) / 10_000);
  return Math.min(max, Math.max(min, target));
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.autoshield as Program<Autoshield>;
  const [poolPda] = PublicKey.findProgramAddressSync([Buffer.from("pool_v2")], program.programId);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), poolPda.toBuffer()], program.programId);

  const kpPath = (process.env.ORACLE_KEYPAIR ?? "~/.config/solana/id.json").replace("~", homedir());
  const oracle = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(kpPath, "utf8"))));
  const pool = await program.account.pool.fetch(poolPda);
  if (!pool.oracle.equals(oracle.publicKey)) {
    throw new Error(`Carteira ${oracle.publicKey.toBase58()} nao e o oraculo do pool (${pool.oracle.toBase58()})`);
  }

  const policies = await program.account.policy.all();
  let updated = 0;
  for (const { publicKey, account: p } of policies) {
    if (!("active" in p.status) || p.hasOpenClaim || !p.fipeCode) continue;
    const [code, year] = p.fipeCode.split("|");
    if (!code || !year) continue;
    const price = await fipePrice(code, year).catch(() => null);
    const current = p.vehicleValue.toNumber();
    if (!price || price === current) continue;
    const next = clamp(current, price);
    console.log(
      `#${p.id.toString()} ${p.model}: ${(current / UNIT).toFixed(2)} -> ${(next / UNIT).toFixed(2)}` +
        (next !== price ? ` (FIPE ${(price / UNIT).toFixed(2)}, limitado a 20%)` : ""),
    );
    if (DRY) continue;
    try {
      await program.methods
        .updatePolicyFipe(new BN(next))
        .accountsPartial({ oracle: oracle.publicKey, pool: poolPda, vault: vaultPda, policy: publicKey })
        .signers([oracle])
        .rpc();
      updated++;
    } catch (e) {
      console.error(`  falhou: ${(e as Error).message}`);
    }
  }
  console.log(`${updated} apolice(s) atualizada(s)${DRY ? " (simulacao)" : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
