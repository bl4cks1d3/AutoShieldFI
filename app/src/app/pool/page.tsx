"use client";

import { ArrowDownToLine, ArrowUpFromLine, Info, Landmark } from "lucide-react";
import { useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { Loading, PageHeader, PoolMissing, Progress, Row, Spinner, Stat, WalletGate } from "@/components/ui";
import { fmtDuration, fmtMoney, fmtPct, shortAddr, toBase } from "@/lib/format";
import { explorerAddr } from "@/lib/config";
import { UNIT } from "@/lib/pricing";

export default function PoolPage() {
  const { client } = useApp();
  const { data, loading } = useData(
    async (c) => ({
      pool: await c.getPool(),
      stake: c.wallet ? await c.getStake(c.wallet) : null,
      balance: c.wallet ? await c.getBalance(c.wallet) : 0,
      now: await c.now(),
    }),
    [client.wallet],
  );
  const { run, busy } = useAction();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  if (loading && !data) return <Loading />;
  if (!data?.pool) return <PoolMissing />;
  const { pool, stake, balance, now } = data;

  const nav = Math.max(0, pool.vaultBalance - pool.reservedCashback);
  const sharePrice = pool.totalShares ? nav / pool.totalShares : 1;
  const required = (pool.totalActiveCoverage * pool.params.minCollateralBps) / 10_000 + pool.pendingClaims;
  const collateralRatio = pool.totalActiveCoverage ? nav / pool.totalActiveCoverage : 0;
  const utilization = nav ? required / nav : 0;
  const lossRatio = pool.totalPremiums ? pool.totalClaimsPaid / pool.totalPremiums : 0;
  const freeToWithdraw = Math.max(0, nav - required);

  const myValue = stake ? Math.floor(stake.shares * sharePrice) : 0;
  const rawPnl = stake ? myValue + stake.totalWithdrawn - stake.totalDeposited : 0;
  const pnl = Math.abs(rawPnl) < 10_000 ? 0 : rawPnl; // ignora arredondamento < 0,01
  const cooldownEnd = stake ? stake.lastDepositTs + pool.params.withdrawCooldownSecs : 0;
  const inCooldown = !!stake && now < cooldownEnd;
  const maxWithdraw = Math.min(myValue, freeToWithdraw);

  const amountBase = toBase(amount);
  const submit = async () => {
    if (tab === "deposit") {
      const sig = await run("deposit", () => client.deposit(amountBase), "Liquidez aportada no pool");
      if (sig) setAmount("");
    } else {
      // converte valor desejado em cotas
      const shares = Math.min(stake?.shares ?? 0, Math.floor(amountBase / sharePrice));
      const sig = await run("withdraw", () => client.withdraw(shares), "Saque realizado");
      if (sig) setAmount("");
    }
  };

  const invalid =
    amountBase <= 0 ||
    (tab === "deposit" ? amountBase > balance : amountBase > maxWithdraw + 1 || inCooldown);

  return (
    <div>
      <PageHeader
        title="Pool de risco & staking"
        subtitle="Aporte stablecoin, receba cotas e seja remunerado pelos prêmios das apólices."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Capital no cofre" value={fmtMoney(pool.vaultBalance)} hint={`${pool.activePolicies} apólices ativas`} />
        <Stat label="Valor da cota" value={sharePrice.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} hint="Começa em 1,0000" />
        <Stat label="Cobertura ativa" value={fmtMoney(pool.totalActiveCoverage)} hint={`Colateral ${fmtPct(collateralRatio)}`} />
        <Stat label="Sinistralidade" value={fmtPct(lossRatio)} hint={`${fmtMoney(pool.totalClaimsPaid)} pagos`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Landmark className="size-5 text-[var(--accent)]" /> Saúde do pool
          </h2>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[var(--muted)]">Capital comprometido</span>
              <span className="num font-semibold">{fmtPct(utilization)}</span>
            </div>
            <Progress value={utilization} tone={utilization > 0.8 ? "warn" : "accent"} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              O contrato exige {fmtPct(pool.params.minCollateralBps / 10_000, 0)} da cobertura ativa + sinistros pendentes
              como capital mínimo. Novas apólices e saques que violem essa regra são recusados on-chain.
            </p>
          </div>
          <div className="mt-4 divide-y divide-[var(--border)] text-sm">
            <Row label="Patrimônio dos cotistas" value={fmtMoney(nav)} />
            <Row label="Capital mínimo exigido" value={fmtMoney(Math.ceil(required))} />
            <Row label="Livre para saque" value={fmtMoney(freeToWithdraw)} />
            <Row label="Cashback reservado a motoristas" value={fmtMoney(pool.reservedCashback)} />
            <Row label="Sinistros pendentes" value={fmtMoney(pool.pendingClaims)} />
            <Row label="Prêmios arrecadados" value={fmtMoney(pool.totalPremiums)} />
            <Row label="Cashback devolvido" value={fmtMoney(pool.totalCashbackPaid)} />
            <Row label="Carência de saque" value={fmtDuration(pool.params.withdrawCooldownSecs)} />
            <Row
              label="Avaliadores"
              value={`${pool.approvalThreshold} de ${pool.assessors.length}`}
            />
            {client.mode === "chain" && (
              <Row
                label="Conta do pool"
                value={
                  <a className="text-[var(--accent)] hover:underline" href={explorerAddr(pool.address)} target="_blank" rel="noreferrer">
                    {shortAddr(pool.address)}
                  </a>
                }
              />
            )}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <WalletGate>
            <div className="card p-5">
              <h2 className="font-semibold">Minha posição</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Valor atual</p>
                  <p className="num text-xl font-bold">{fmtMoney(myValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Resultado</p>
                  <p className={`num text-xl font-bold ${pnl > 0 ? "text-[var(--ok)]" : pnl < 0 ? "text-[var(--bad)]" : ""}`}>
                    {pnl > 0 ? "+" : pnl < 0 ? "−" : ""}
                    {fmtMoney(Math.abs(pnl))}
                  </p>
                </div>
              </div>
              <div className="mt-3 divide-y divide-[var(--border)] text-sm">
                <Row
                  label="Cotas"
                  value={((stake?.shares ?? 0) / UNIT).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                />
                <Row label="Participação no pool" value={fmtPct(pool.totalShares ? (stake?.shares ?? 0) / pool.totalShares : 0, 2)} />
                <Row label="Total aportado" value={fmtMoney(stake?.totalDeposited ?? 0)} />
                <Row label="Total sacado" value={fmtMoney(stake?.totalWithdrawn ?? 0)} />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold">
                <button
                  onClick={() => setTab("deposit")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "deposit" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
                >
                  <ArrowDownToLine className="size-4" /> Aportar
                </button>
                <button
                  onClick={() => setTab("withdraw")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "withdraw" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
                >
                  <ArrowUpFromLine className="size-4" /> Sacar
                </button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="amt">Valor</label>
                  <button
                    className="text-xs font-semibold text-[var(--accent)]"
                    onClick={() => setAmount((Math.floor((tab === "deposit" ? balance : maxWithdraw) / 10_000) / 100).toFixed(2).replace(".", ","))}
                  >
                    Máx: {fmtMoney(tab === "deposit" ? balance : maxWithdraw)}
                  </button>
                </div>
                <input
                  id="amt"
                  className="input num"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                />
                {tab === "withdraw" && inCooldown && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-[var(--warn)]">
                    <Info className="size-3.5" /> Carência: saque liberado em {fmtDuration(cooldownEnd - now)}.
                  </p>
                )}
                <button className="btn btn-primary mt-4 w-full" disabled={invalid || !!busy} onClick={submit}>
                  {busy && <Spinner />} {tab === "deposit" ? "Aportar no pool" : "Sacar do pool"}
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Os cotistas absorvem os sinistros e ficam com os prêmios. O valor da cota sobe quando prêmios superam
                  indenizações.
                </p>
              </div>
            </div>
          </WalletGate>
        </section>
      </div>
    </div>
  );
}
