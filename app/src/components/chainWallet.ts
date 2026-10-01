"use client";

// Carteiras de extensao (MetaMask, Phantom, Solflare...) via Wallet Standard.
// O adaptador padrao nao informa a rede em signTransaction, entao a carteira
// simula na rede selecionada nela (ex.: Mainnet) e a transacao "reverte".
// Aqui chamamos o recurso solana:signTransaction direto, com a rede do app.

import { useAnchorWallet, useWallet, type AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useMemo } from "react";
import { CLUSTER_LABEL, WALLET_CHAIN } from "@/lib/config";
import { tr } from "@/lib/i18n";

type AnyTx = Transaction | VersionedTransaction;

interface StdAccount {
  address: string;
  chains: readonly string[];
  features: readonly string[];
}
interface StdSignTransaction {
  signTransaction(...inputs: { account: StdAccount; chain?: string; transaction: Uint8Array }[]): Promise<
    readonly { signedTransaction: Uint8Array }[]
  >;
}
interface StdWallet {
  accounts: readonly StdAccount[];
  features: Record<string, unknown>;
}

const SIGN = "solana:signTransaction";

function serialize(tx: AnyTx): Uint8Array {
  return tx instanceof VersionedTransaction
    ? tx.serialize()
    : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

function deserialize<T extends AnyTx>(original: T, bytes: Uint8Array): T {
  return (original instanceof VersionedTransaction ? VersionedTransaction.deserialize(bytes) : Transaction.from(bytes)) as T;
}

/** Mensagem clara quando a carteira nao tem a rede do app habilitada. */
function networkError(cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    tr(
      `A carteira não assinou na ${CLUSTER_LABEL}. Ative a rede ${CLUSTER_LABEL} na carteira (MetaMask: extensão com "Show test networks"; Phantom: Testnet Mode) ou entre com Google. (${detail})`,
      `The wallet did not sign on ${CLUSTER_LABEL}. Enable ${CLUSTER_LABEL} in your wallet (MetaMask: extension with "Show test networks"; Phantom: Testnet Mode) or sign in with Google. (${detail})`,
    ),
  );
}

/**
 * AnchorWallet que assina informando a rede do app (Wallet Standard).
 * Se a carteira nao expuser o Wallet Standard, cai no adaptador comum.
 */
export function useChainAnchorWallet(): AnchorWallet | undefined {
  const fallback = useAnchorWallet();
  const { wallet, publicKey } = useWallet();

  return useMemo(() => {
    const std = (wallet?.adapter as unknown as { wallet?: StdWallet } | undefined)?.wallet;
    const feature = std?.features[SIGN] as StdSignTransaction | undefined;
    const account = std?.accounts.find((a) => publicKey && a.address === publicKey.toBase58()) ?? std?.accounts[0];
    if (!std || !feature || !account || !publicKey) return fallback;

    const signTransaction = async <T extends AnyTx>(tx: T): Promise<T> => {
      try {
        const [out] = await feature.signTransaction({ account, chain: WALLET_CHAIN, transaction: serialize(tx) });
        return deserialize(tx, out.signedTransaction);
      } catch (e) {
        // recusa do usuario continua sendo recusa; o resto vira instrucao de rede
        if (e instanceof Error && /reject|denied|cancel/i.test(e.message)) throw e;
        throw networkError(e);
      }
    };
    return {
      publicKey: new PublicKey(account.address),
      signTransaction,
      signAllTransactions: async <T extends AnyTx>(txs: T[]) => {
        const out: T[] = [];
        for (const tx of txs) out.push(await signTransaction(tx));
        return out;
      },
    };
  }, [wallet, publicKey, fallback]);
}
