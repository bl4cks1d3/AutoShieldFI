"use client";

import { ConnectionProvider, WalletProvider, useConnection } from "@solana/wallet-adapter-react";
import { useChainAnchorWallet } from "./chainWallet";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_MODE, DEMO_ENABLED, RPC_URL } from "@/lib/config";
import { DemoClient } from "@/lib/client/demo";
import { OnChainClient } from "@/lib/client/onchain";
import type { AutoShieldClient } from "@/lib/types";
import { ToastProvider, useToastCtx } from "./Toast";
import { AuthProvider, usePrivyAnchorWallet } from "./PrivyAuth";
import { errMsg } from "@/lib/format";
import { I18nProvider, tr } from "@/lib/i18n";

import "@solana/wallet-adapter-react-ui/styles.css";

type Mode = "demo" | "chain";

interface AppCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
  client: AutoShieldClient;
  version: number;
  refresh: () => void;
}

const Ctx = createContext<AppCtx | null>(null);
const MODE_KEY = "autoshield-mode";

function AppStateProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  // Carteira de extensao (Phantom, Solflare, MetaMask) tem prioridade; senao, a
  // carteira embutida do login com Google/e-mail. As duas assinam na rede do app.
  const adapterWallet = useChainAnchorWallet();
  const privyWallet = usePrivyAnchorWallet();
  const wallet = adapterWallet ?? privyWallet;
  const [mode, setModeState] = useState<Mode>(DEFAULT_MODE);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!DEMO_ENABLED) return;
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "demo" || saved === "chain") setModeState(saved);
    } catch {
      /* ignora */
    }
  }, []);

  const setMode = useCallback((m: Mode) => {
    if (!DEMO_ENABLED && m === "demo") return;
    setModeState(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignora */
    }
  }, []);

  const client = useMemo<AutoShieldClient>(
    () => (mode === "demo" ? new DemoClient() : new OnChainClient(connection, wallet ?? null)),
    [mode, connection, wallet],
  );

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Atualizacao periodica para refletir mudancas on-chain.
  useEffect(() => {
    const id = setInterval(refresh, mode === "chain" ? 15_000 : 5_000);
    return () => clearInterval(id);
  }, [mode, refresh]);

  const value = useMemo(
    () => ({ mode, setMode, client, version, refresh }),
    [mode, setMode, client, version, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
    <AuthProvider>
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <AppStateProvider>
            <ToastProvider>{children}</ToastProvider>
          </AppStateProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
    </AuthProvider>
    </I18nProvider>
  );
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do Providers");
  return c;
}

/** Carrega dados assincronos e recarrega quando o estado global muda. */
export function useData<T>(fn: (client: AutoShieldClient) => Promise<T>, deps: unknown[] = []) {
  const { client, version } = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fn(client)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => alive && setError(String(e?.message ?? e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, version, ...deps]);

  return { data, error, loading };
}

/** Executa uma transacao, mostra toast e atualiza os dados. */
export function useAction() {
  const { refresh } = useApp();
  const { push } = useToastCtx();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, fn: () => Promise<string>, success?: string) => {
      setBusy(label);
      try {
        const sig = await fn();
        push({ kind: "success", title: success ?? tr("Transação confirmada", "Transaction confirmed"), sig });
        refresh();
        return sig;
      } catch (e) {
        push({ kind: "error", title: tr("Falha na operação", "Operation failed"), body: errMsg(e) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [push, refresh],
  );

  return { run, busy };
}

