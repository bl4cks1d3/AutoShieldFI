/**
 * Verificacao rapida do estado on-chain: le o pool com o IDL atual e conta as
 * contas do programa por tipo (detecta contas em layout antigo).
 * Uso: RPC_URL=<rpc> npx tsx scripts/check-devnet.ts
 */
import { AnchorProvider, BorshAccountsCoder, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../src/idl/autoshield.json";
import type { Autoshield } from "../src/idl/autoshield";

async function main() {
  const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const program = new Program<Autoshield>(idl as any, new AnchorProvider(conn, new Wallet(Keypair.generate()), {}));
  const [pool] = PublicKey.findProgramAddressSync([Buffer.from("pool_v2")], program.programId);
  const p = await program.account.pool.fetch(pool);
  console.log("pool ok:", pool.toBase58(), "versao", p.version, "bonusDays", p.bonusDaysPerClass, "apolices", p.policyCount.toString());

  const coder = new BorshAccountsCoder(idl as any);
  const accounts = await conn.getProgramAccounts(program.programId, { dataSlice: { offset: 0, length: 8 } });
  const counts: Record<string, number> = {};
  for (const a of accounts) {
    const disc = Buffer.from(a.account.data);
    const name = (idl as any).accounts.find((x: any) => Buffer.from(x.discriminator).equals(disc))?.name ?? "desconhecida";
    counts[name] = (counts[name] ?? 0) + 1;
  }
  console.log("contas por tipo:", counts);
  // Tenta decodificar apolices e sinistros com o layout atual.
  for (const name of ["policy", "claim"] as const) {
    const all = await conn.getProgramAccounts(program.programId, {
      filters: [{ memcmp: { offset: 0, bytes: require("bs58").encode(coder.accountDiscriminator(name === "policy" ? "Policy" : "Claim")) } }],
    });
    let bad = 0;
    for (const a of all) {
      try {
        coder.decode(name === "policy" ? "Policy" : "Claim", a.account.data);
      } catch {
        bad++;
      }
    }
    console.log(`${name}: ${all.length} contas, ${bad} ilegiveis no layout atual`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
