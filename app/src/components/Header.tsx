"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Coins, Droplets, FastForward, Menu, RotateCcw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { advanceDemoTime, resetDemo } from "@/lib/client/demo";
import { CLUSTER_LABEL, STABLE_SYMBOL } from "@/lib/config";
import { fmtMoney } from "@/lib/format";
import { UNIT } from "@/lib/pricing";
import { useAction, useApp, useData } from "./Providers";
import { Spinner, WalletButton } from "./ui";

const NAV = [
  { href: "/cotar", label: "Contratar" },
  { href: "/apolices", label: "Minhas apólices" },
  { href: "/sinistros", label: "Sinistros" },
  { href: "/pool", label: "Pool & Staking" },
  { href: "/avaliacao", label: "Avaliação" },
  { href: "/admin", label: "Governança" },
];

export function Header() {
  const path = usePathname();
  const { mode, setMode, client, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const { run, busy } = useAction();
  const { data: balance } = useData((c) => (c.wallet ? c.getBalance(c.wallet) : Promise.resolve(0)), [client.wallet]);
  const { data: pool } = useData((c) => c.getPool());
  const { connection } = useConnection();
  const { data: sol } = useData(
    (c) => (c.mode === "chain" && c.wallet ? connection.getBalance(new PublicKey(c.wallet)) : Promise.resolve(null)),
    [client.wallet, connection],
  );

  const airdrop = () =>
    run(
      "airdrop",
      async () => {
        const sig = await connection.requestAirdrop(new PublicKey(client.wallet!), 2 * LAMPORTS_PER_SOL);
        const bh = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
        return sig;
      },
      "+2 SOL recebidos para taxas",
    );

  const faucet = () =>
    run("faucet", () => client.faucet(50_000 * UNIT), `+50.000 ${STABLE_SYMBOL} recebidos`);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <ShieldCheck className="size-5" />
          </span>
          <span className="text-lg">
            AutoShield<span className="text-[var(--accent)]">FI</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                path === n.href ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded-xl border border-[var(--border)] p-0.5 text-xs font-semibold sm:flex">
            <button
              onClick={() => setMode("demo")}
              className={`rounded-lg px-2.5 py-1.5 ${mode === "demo" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
            >
              Demo
            </button>
            <button
              onClick={() => setMode("chain")}
              className={`rounded-lg px-2.5 py-1.5 ${mode === "chain" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
            >
              {CLUSTER_LABEL}
            </button>
          </div>
          {mode === "chain" && <WalletButton />}
          <button className="btn btn-ghost !p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {client.wallet && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-soft)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
            <span className="num">
              Saldo: <b>{fmtMoney(balance ?? 0)}</b>
            </span>
            {sol !== null && sol !== undefined && (
              <span className="num">
                <b>{(sol / LAMPORTS_PER_SOL).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</b> SOL
              </span>
            )}
            {mode === "chain" && CLUSTER_LABEL !== "Mainnet" && (
              <button onClick={airdrop} disabled={!!busy} className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
                {busy === "airdrop" ? <Spinner className="size-3.5" /> : <Droplets className="size-3.5" />}
                Airdrop SOL
              </button>
            )}
            {pool?.params.faucetEnabled && (
              <button onClick={faucet} disabled={!!busy} className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
                {busy === "faucet" ? <Spinner className="size-3.5" /> : <Coins className="size-3.5" />}
                Faucet {STABLE_SYMBOL}
              </button>
            )}
            {mode === "demo" && (
              <>
                <span className="text-[var(--muted)]">Modo demonstração — dados simulados no navegador</span>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => {
                      advanceDemoTime(7 * 86400);
                      refresh();
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                    title="Avança o relógio da simulação em 7 dias"
                  >
                    <FastForward className="size-3.5" /> +7 dias
                  </button>
                  <button
                    onClick={() => {
                      advanceDemoTime(30 * 86400);
                      refresh();
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                    title="Avança o relógio da simulação em 30 dias"
                  >
                    <FastForward className="size-3.5" /> +30 dias
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Apagar todos os dados da demonstração?")) {
                        resetDemo();
                        refresh();
                      }
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--muted)] hover:text-[var(--bad)]"
                  >
                    <RotateCcw className="size-3.5" /> Reiniciar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {open && (
        <nav className="border-t border-[var(--border)] px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 font-medium ${path === n.href ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-3 flex items-center rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold sm:hidden">
            <button
              onClick={() => setMode("demo")}
              className={`flex-1 rounded-lg px-2.5 py-2 ${mode === "demo" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
            >
              Demo
            </button>
            <button
              onClick={() => setMode("chain")}
              className={`flex-1 rounded-lg px-2.5 py-2 ${mode === "chain" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
            >
              {CLUSTER_LABEL}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
