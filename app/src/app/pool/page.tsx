"use client";

import { ArrowDownToLine, ArrowUpFromLine, Info, Landmark } from "lucide-react";
import { useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { Loading, PageHeader, PoolMissing, Progress, Row, Spinner, Stat, WalletGate } from "@/components/ui";
import { fmtDuration, fmtInput, fmtMoney, fmtNum, fmtPct, shortAddr, toBase } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  if (loading && !data) return <Loading />;
  if (!data?.pool) return <PoolMissing />;
  const { pool, stake, balance, now } = data;

  const liabilities = pool.reservedCashback + pool.treasuryAccrued + pool.pendingInspectionFees;
  const nav = Math.max(0, pool.vaultBalance - liabilities);
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
  const pendingShares = stake?.pendingWithdrawShares ?? 0;
  const pendingValue = Math.floor(pendingShares * sharePrice);
  const noticeLeft = stake ? stake.withdrawAvailableAt - now : 0;
  const canExecute = pendingShares > 0 && noticeLeft <= 0 && !inCooldown;
  const maxWithdraw = Math.min(myValue, freeToWithdraw);

  const amountBase = toBase(amount);
  const submit = async () => {
    if (tab === "deposit") {
      const sig = await run("deposit", () => client.deposit(amountBase), t("Liquidez aportada no pool", "Liquidity added to the pool"));
      if (sig) setAmount("");
    } else {
      // passo 1: pedir o saque (converte o valor desejado em cotas)
      const shares = Math.min(stake?.shares ?? 0, Math.floor(amountBase / sharePrice));
      const sig = await run(
        "withdraw",
        () => client.requestWithdraw(shares),
        t(
          `Saque pedido: liberado em ${fmtDuration(pool.params.withdrawNoticeSecs)}`,
          `Withdrawal requested: available in ${fmtDuration(pool.params.withdrawNoticeSecs)}`,
        ),
      );
      if (sig) setAmount("");
    }
  };

  // passo 2: executar o saque pedido, apos o aviso previo
  const execute = () =>
    run("execute", () => client.withdraw(Math.min(pendingShares, stake?.shares ?? 0)), t("Saque realizado", "Withdrawal completed"));

  const invalid =
    amountBase <= 0 ||
    (tab === "deposit" ? amountBase > balance : amountBase > myValue + 1);

  return (
    <div>
      <PageHeader
        title={t("Pool de risco & staking", "Risk pool & staking")}
        subtitle={t(
          "Aporte stablecoin, receba cotas e seja remunerado pelos prêmios das apólices.",
          "Deposit stablecoins, receive shares and earn from policy premiums.",
        )}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t("Capital no cofre", "Vault capital")}
          value={fmtMoney(pool.vaultBalance)}
          hint={`${pool.activePolicies} ${t("apólices ativas", "active policies")}`}
        />
        <Stat label={t("Valor da cota", "Share price")} value={fmtNum(sharePrice, 4)} hint={`${t("Começa em", "Starts at")} ${fmtNum(1, 4)}`} />
        <Stat
          label={t("Cobertura ativa", "Active coverage")}
          value={fmtMoney(pool.totalActiveCoverage)}
          hint={`${t("Colateral", "Collateral")} ${fmtPct(collateralRatio)}`}
        />
        <Stat
          label={t("Sinistralidade", "Loss ratio")}
          value={fmtPct(lossRatio)}
          hint={`${fmtMoney(pool.totalClaimsPaid)} ${t("pagos", "paid")}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Landmark className="size-5 text-[var(--accent)]" /> {t("Saúde do pool", "Pool health")}
          </h2>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[var(--muted)]">{t("Capital comprometido", "Capital committed")}</span>
              <span className="num font-semibold">{fmtPct(utilization)}</span>
            </div>
            <Progress value={utilization} tone={utilization > 0.8 ? "warn" : "accent"} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t(
                `O contrato exige ${fmtPct(pool.params.minCollateralBps / 10_000, 0)} da cobertura ativa + sinistros pendentes como capital mínimo. Novas apólices e saques que violem essa regra são recusados on-chain.`,
                `The contract requires ${fmtPct(pool.params.minCollateralBps / 10_000, 0)} of active coverage + pending claims as minimum capital. New policies and withdrawals that break this rule are rejected on-chain.`,
              )}
            </p>
          </div>
          <div className="mt-4 divide-y divide-[var(--border)] text-sm">
            <Row label={t("Patrimônio dos cotistas", "Shareholder equity")} value={fmtMoney(nav)} />
            <Row label={t("Capital mínimo exigido", "Minimum required capital")} value={fmtMoney(Math.ceil(required))} />
            <Row label={t("Livre para saque", "Free to withdraw")} value={fmtMoney(freeToWithdraw)} />
            <Row label={t("Cashback reservado a motoristas", "Cashback reserved for drivers")} value={fmtMoney(pool.reservedCashback)} />
            <Row label={t("Receita do protocolo (tesouraria)", "Protocol revenue (treasury)")} value={fmtMoney(pool.treasuryAccrued)} />
            <Row label={t("Taxas de vistoria pendentes", "Pending inspection fees")} value={fmtMoney(pool.pendingInspectionFees)} />
            <Row label={t("Sinistros pendentes", "Pending claims")} value={fmtMoney(pool.pendingClaims)} />
            <Row label={t("Prêmios arrecadados", "Premiums collected")} value={fmtMoney(pool.totalPremiums)} />
            <Row
              label={t(
                `Taxa do protocolo (${pool.params.protocolFeeBps / 100}% do prêmio)`,
                `Protocol fee (${pool.params.protocolFeeBps / 100}% of premium)`,
              )} value={fmtMoney(pool.totalProtocolFees)} />
            <Row label={t("Pago a avaliadores", "Paid to assessors")} value={fmtMoney(pool.totalAssessorRewards)} />
            <Row label={t("Cashback devolvido", "Cashback returned")} value={fmtMoney(pool.totalCashbackPaid)} />
            <Row label={t("Carência de saque", "Withdrawal cooldown")} value={fmtDuration(pool.params.withdrawCooldownSecs)} />
            <Row label={t("Aviso prévio de saque", "Withdrawal notice")} value={fmtDuration(pool.params.withdrawNoticeSecs)} />
            <Row
              label={t("Cobertura máxima por apólice", "Maximum coverage per policy")}
              value={`${fmtMoney(Math.floor((nav * pool.params.maxPolicyCoverageBps) / 10_000))} (${pool.params.maxPolicyCoverageBps / 100}% ${t("do patrimônio", "of equity")})`}
            />
            <Row
              label={t("Avaliadores", "Assessors")}
              value={`${pool.approvalThreshold} ${t("de", "of")} ${pool.assessors.length}`}
            />
            {client.mode === "chain" && (
              <Row
                label={t("Conta do pool", "Pool account")}
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
              <h2 className="font-semibold">{t("Minha posição", "My position")}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">{t("Valor atual", "Current value")}</p>
                  <p className="num text-xl font-bold">{fmtMoney(myValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t("Resultado", "Profit / loss")}</p>
                  <p className={`num text-xl font-bold ${pnl > 0 ? "text-[var(--ok)]" : pnl < 0 ? "text-[var(--bad)]" : ""}`}>
                    {pnl > 0 ? "+" : pnl < 0 ? "−" : ""}
                    {fmtMoney(Math.abs(pnl))}
                  </p>
                </div>
              </div>
              <div className="mt-3 divide-y divide-[var(--border)] text-sm">
                <Row
                  label={t("Cotas", "Shares")}
                  value={fmtNum((stake?.shares ?? 0) / UNIT)}
                />
                <Row label={t("Participação no pool", "Pool ownership")} value={fmtPct(pool.totalShares ? (stake?.shares ?? 0) / pool.totalShares : 0, 2)} />
                <Row label={t("Total aportado", "Total deposited")} value={fmtMoney(stake?.totalDeposited ?? 0)} />
                <Row label={t("Total sacado", "Total withdrawn")} value={fmtMoney(stake?.totalWithdrawn ?? 0)} />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold">
                <button
                  onClick={() => setTab("deposit")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "deposit" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
                >
                  <ArrowDownToLine className="size-4" /> {t("Aportar", "Deposit")}
                </button>
                <button
                  onClick={() => setTab("withdraw")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "withdraw" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
                >
                  <ArrowUpFromLine className="size-4" /> {t("Sacar", "Withdraw")}
                </button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="amt">{t("Valor", "Amount")}</label>
                  <button
                    className="text-xs font-semibold text-[var(--accent)]"
                    onClick={() => setAmount(fmtInput(Math.floor((tab === "deposit" ? balance : maxWithdraw) / 10_000) / 100, 2))}
                  >
                    {t("Máx", "Max")}: {fmtMoney(tab === "deposit" ? balance : maxWithdraw)}
                  </button>
                </div>
                <input
                  id="amt"
                  className="input num"
                  inputMode="decimal"
                  placeholder={fmtInput(0, 2)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                />
                {tab === "withdraw" && pendingShares > 0 && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] p-3 text-sm">
                    <p>
                      {t("Saque pedido", "Withdrawal requested")}: <b>{fmtMoney(pendingValue)}</b> ({fmtNum(pendingShares / UNIT)}{" "}
                      {t("cotas", "shares")})
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {noticeLeft > 0
                        ? t(
                            `Aviso prévio: libera em ${fmtDuration(noticeLeft)}. Até lá as cotas seguem expostas aos sinistros.`,
                            `Notice period: available in ${fmtDuration(noticeLeft)}. Until then the shares remain exposed to claims.`,
                          )
                        : t(
                            "Aviso prévio cumprido. O valor final é calculado no momento do saque.",
                            "Notice period complete. The final amount is calculated at withdrawal time.",
                          )}
                    </p>
                    <button className="btn btn-primary mt-2 w-full" disabled={!canExecute || !!busy} onClick={execute}>
                      {busy === "execute" && <Spinner />} {t("Sacar", "Withdraw")} {fmtMoney(Math.min(pendingValue, maxWithdraw))}
                    </button>
                  </div>
                )}
                {tab === "withdraw" && inCooldown && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-[var(--warn)]">
                    <Info className="size-3.5" /> {t("Carência: saque liberado em", "Cooldown: withdrawal available in")}{" "}
                    {fmtDuration(cooldownEnd - now)}.
                  </p>
                )}
                <button className="btn btn-primary mt-4 w-full" disabled={invalid || !!busy} onClick={submit}>
                  {busy === "deposit" || busy === "withdraw" ? <Spinner /> : null}{" "}
                  {tab === "deposit"
                    ? t("Aportar no pool", "Deposit into pool")
                    : pendingShares > 0
                      ? t("Refazer pedido de saque", "Update withdrawal request")
                      : t("Pedir saque", "Request withdrawal")}
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t(
                    "Os cotistas absorvem os sinistros e ficam com os prêmios. O valor da cota sobe quando prêmios superam indenizações.",
                    "Shareholders absorb the claims and keep the premiums. The share price rises when premiums exceed payouts.",
                  )}
                </p>
              </div>
            </div>
          </WalletGate>
        </section>
      </div>
    </div>
  );
}
