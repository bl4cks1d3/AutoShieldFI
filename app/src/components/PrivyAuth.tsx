"use client";

// Login social (Google / e-mail) com carteira Solana embutida, via Privy.
// A carteira embutida e exposta no mesmo formato AnchorWallet usado pelas
// carteiras de extensao (Phantom, Solflare), entao o resto do app nao muda.

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { LogIn, LogOut, Mail } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { PRIVY_APP_ID, WALLET_CHAIN } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const PRIVY_ENABLED = !!PRIVY_APP_ID;

// Rede em que a carteira embutida assina: segue o cluster configurado no app
// (a Privy nao tem localnet; nesse caso usa devnet).
const CHAIN = WALLET_CHAIN === "solana:localnet" ? "solana:devnet" : WALLET_CHAIN;

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "email"],
        appearance: { walletChainType: "solana-only", theme: "dark", accentColor: "#2dd4a3" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

type AnyTx = Transaction | VersionedTransaction;

function serialize(tx: AnyTx): Uint8Array {
  return tx instanceof VersionedTransaction
    ? tx.serialize()
    : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

function deserialize<T extends AnyTx>(original: T, bytes: Uint8Array): T {
  return (original instanceof VersionedTransaction
    ? VersionedTransaction.deserialize(bytes)
    : Transaction.from(bytes)) as T;
}

/** Carteira embutida da Privy como AnchorWallet (ou null se nao logado). */
function usePrivyAnchorWalletImpl(): AnchorWallet | null {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = authenticated
    ? (wallets.find((w) => w.standardWallet.name.toLowerCase().includes("privy")) ?? wallets[0])
    : undefined;

  return useMemo(() => {
    if (!wallet) return null;
    const sign = async <T extends AnyTx>(tx: T): Promise<T> => {
      const { signedTransaction } = await signTransaction({ transaction: serialize(tx), wallet, chain: CHAIN });
      return deserialize(tx, signedTransaction);
    };
    return {
      publicKey: new PublicKey(wallet.address),
      signTransaction: sign,
      signAllTransactions: async <T extends AnyTx>(txs: T[]) => {
        const out: T[] = [];
        for (const tx of txs) out.push(await sign(tx));
        return out;
      },
    };
  }, [wallet, signTransaction]);
}

// Sem App ID configurado, os hooks da Privy nao podem ser usados (nao ha provider).
export const usePrivyAnchorWallet: () => AnchorWallet | null = PRIVY_ENABLED ? usePrivyAnchorWalletImpl : () => null;

function LoginButtonImpl({ className = "" }: { className?: string }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { t } = useI18n();
  if (!ready) return null;

  if (!authenticated)
    return (
      <button className={`btn btn-ghost ${className}`} onClick={() => login()}>
        <LogIn className="size-4" /> {t("Entrar com Google ou e-mail", "Sign in with Google or email")}
      </button>
    );

  const who = user?.google?.email ?? user?.email?.address ?? (wallets[0] ? shortAddr(wallets[0].address) : "");
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <Mail className="size-4 text-[var(--accent)]" />
      <span className="max-w-40 truncate" title={who}>
        {who}
      </span>
      <button className="btn btn-ghost !px-2 !py-1.5" onClick={() => logout()} title={t("Sair", "Sign out")}>
        <LogOut className="size-4" />
      </button>
    </span>
  );
}

/** Botao "Entrar com Google" / conta logada. Nao renderiza nada sem App ID. */
export function LoginButton(props: { className?: string }) {
  return PRIVY_ENABLED ? <LoginButtonImpl {...props} /> : null;
}
