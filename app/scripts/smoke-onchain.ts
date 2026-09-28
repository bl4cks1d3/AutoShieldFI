/**
 * Teste de fumaca do cliente on-chain usado pelo frontend.
 * Executa o fluxo completo (faucet -> apolice -> sinistro -> voto -> pagamento
 * -> liquidacao) contra um cluster com o pool ja inicializado (yarn bootstrap).
 *
 * Uso: RPC_URL=http://127.0.0.1:8899 KEYPAIR=~/.config/solana/id.json npx tsx scripts/smoke-onchain.ts
 * A carteira precisa ser avaliadora do pool (o admin do bootstrap e).
 */
import { Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { OnChainClient } from "../src/lib/client/onchain";
import { quote, UNIT } from "../src/lib/pricing";

const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const kpPath = (process.env.KEYPAIR ?? "~/.config/solana/id.json").replace("~", homedir());
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(kpPath, "utf8"))));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const client = new OnChainClient(new Connection(rpc, "confirmed"), new Wallet(kp));
  const me = client.wallet!;
  const pool = await client.getPool();
  if (!pool) throw new Error("Pool nao inicializado — rode yarn bootstrap");
  console.log("pool ok, capital:", pool.vaultBalance / UNIT);

  await client.faucet(20_000 * UNIT);
  const bal0 = await client.getBalance(me);
  console.log("saldo apos faucet:", bal0 / UNIT);

  const q = quote(pool.params, 60_000 * UNIT, "standard", 30);
  await client.purchase({
    plate: "SMK1E23",
    model: "Smoke Test Car",
    year: 2022,
    vehicleValue: 60_000 * UNIT,
    tier: "standard",
    durationDays: 30,
    maxPremium: q.premium,
  });
  const policies = await client.getPolicies(me);
  const policy = policies[0];
  if (policy.premiumPaid !== q.premium) throw new Error("premio divergente do calculo do frontend");
  console.log("apolice", policy.id, "premio", policy.premiumPaid / UNIT, "== cotacao do frontend");

  await client.fileClaim(policy.address, {
    kind: "collision",
    amount: 5_000 * UNIT,
    description: "Smoke test: colisao leve",
    evidenceUri: "sha256:smoke",
  });
  let claims = await client.getClaims(me);
  const claim = claims[0];
  console.log("sinistro", claim.id, claim.status);

  await client.vote(claim.address, true);
  claims = await client.getClaims(me);
  console.log("apos voto:", claims[0].status);

  const before = await client.getBalance(me);
  await client.payClaim(claim.address);
  const paid = (await client.getBalance(me)) - before;
  console.log("indenizacao recebida:", paid / UNIT, "(5000 - franquia 3000)");
  if (paid !== 2_000 * UNIT) throw new Error("indenizacao inesperada");

  // espera o vencimento (requer SECONDS_PER_DAY pequeno no bootstrap)
  const endTs = (await client.getPolicies(me))[0].endTs;
  while ((await client.now()) <= endTs) await sleep(1000);
  await client.settle(policy.address);
  const final = (await client.getPolicies(me))[0];
  console.log("apolice encerrada:", final.status, "cashback resgatado:", final.cashbackRedeemed);

  const stake = await client.getStake(me);
  console.log("posicao LP (cotas):", (stake?.shares ?? 0) / UNIT);
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
