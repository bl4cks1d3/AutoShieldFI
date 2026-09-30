/**
 * Credencia uma oficina no pool (somente a autoridade do pool).
 *
 * Uso:
 *   SHOP_WALLET=<pubkey> SHOP_NAME="Oficina X" SHOP_CITY="Goiania" \
 *     anchor run shop --provider.cluster devnet
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Autoshield } from "../target/types/autoshield";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.autoshield as Program<Autoshield>;
  const wallet = new PublicKey(process.env.SHOP_WALLET ?? "");
  const name = (process.env.SHOP_NAME ?? "Oficina credenciada").slice(0, 48);
  const city = (process.env.SHOP_CITY ?? "").slice(0, 32);

  const [pool] = PublicKey.findProgramAddressSync([Buffer.from("pool_v2")], program.programId);
  const [shop] = PublicKey.findProgramAddressSync([Buffer.from("shop"), wallet.toBuffer()], program.programId);

  const existing = await program.account.repairShop.fetchNullable(shop);
  if (existing) {
    console.log(`Oficina ja credenciada: ${existing.name} (${existing.active ? "ativa" : "suspensa"})`);
    return;
  }
  const sig = await program.methods
    .registerShop(wallet, name, city)
    .accountsPartial({ authority: provider.wallet.publicKey, pool, shop })
    .rpc();
  console.log(`Oficina credenciada: ${name} · carteira ${wallet.toBase58()} · conta ${shop.toBase58()}`);
  console.log(`Transacao: ${sig}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
