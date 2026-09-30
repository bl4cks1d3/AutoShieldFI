"use client";

import { ArrowDownToLine, ArrowUpFromLine, Info, Landmark, Layers } from "lucide-react";
import { useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { Loading, PageHeader, PoolMissing, Progress, Row, Spinner, Stat, WalletGate } from "@/components/ui";
import { fmtDuration, fmtInput, fmtMoney, fmtNum, fmtPct, shortAddr, toBase } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { explorerAddr } from "@/lib/config";
import { UNIT } from "@/lib/pricing";

type ShareClass = "senior" | "junior";

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
  const [cls, setCls] = useState<ShareClass>("senior");
  const [amount, setAmount] = useState("");

  if (loading && !data) return <Loading />;
  if (!data?.pool) return <PoolMissing />;
  const { pool, stake, balance, now } = data;

  const liabilities = pool.reservedCashback + pool.treasuryAccrued + pool.pendingInspectionFees + pool.assessorBonds;
  const nav = Math.max(0, pool.vaultBalance - liabilities);
  // Classe junior (primeira perda) e senior: mesmas regras de Pool no contrato.
  const juniorNav = Math.min(pool.juniorCapital, nav);
  const seniorNav = Math.max(0, nav - pool.juniorCapital);
  const seniorPrice = pool.totalShares ? seniorNav / pool.totalShares : 1;
  const juniorPrice = pool.juniorShares ? juniorNav / pool.juniorShares : 1;
  const juniorWeight = pool.juniorWeightBps / 10_000;
  // Parte da receita dos LPs que vai para cada classe hoje.
  const jWeighted = juniorNav * juniorWeight;
  const juniorIncomeShare = jWeighted + seniorNav > 0 ? jWeighted / (jWeighted + seniorNav) : 0;
  const cushion = pool.totalActiveCoverage ? juniorNav / pool.totalActiveCoverage : 0;

  const required = (pool.totalActiveCoverage * pool.params.minCollateralBps) / 10_000 + pool.pendingClaims;
  const collateralRatio = pool.totalActiveCoverage ? nav / pool.totalActiveCoverage : 0;
  const utilization = nav ? required / nav : 0;
  const lossRatio = pool.totalPremiums ? pool.totalClaimsPaid / pool.totalPremiums : 0;
  const freeToWithdraw = Math.max(0, nav - required);

  const seniorShares = stake?.shares ?? 0;
  const juniorShares = stake?.juniorShares ?? 0;
  const seniorValue = Math.floor(seniorShares * seniorPrice);
  const juniorValue = Math.floor(juniorShares * juniorPrice);
  const myValue = seniorValue + juniorValue;
  const rawPnl = stake ? myValue + stake.totalWithdrawn - stake.totalDeposited : 0;
  const pnl = Math.abs(rawPnl) < 10_000 ? 0 : rawPnl; // ignora arredondamento < 0,01
  const cooldownEnd = stake ? stake.lastDepositTs + pool.params.withdrawCooldownSecs : 0;
  const inCooldown = !!stake && now < cooldownEnd;

  const junior = cls === "junior";
  const price = junior ? juniorPrice : seniorPrice;
  const classShares = junior ? juniorShares : seniorShares;
  const classValue = junior ? juniorValue : seniorValue;
  const pendingShares = (junior ? stake?.pendingJuniorWithdraw : stake?.pendingWithdrawShares) ?? 0;
  const pendingValue = Math.floor(pendingShares * price);
  const noticeLeft = stake ? stake.withdrawAvailableAt - now : 0;
  const canExecute = pendingShares > 0 && noticeLeft <= 0 && !inCooldown;
  const maxWithdraw = Math.min(classValue, freeToWithdraw);
  const juniorWiped = pool.juniorShares > 0 && juniorNav <= 0;

  const amountBase = toBase(amount);
  const submit = async () => {
    if (tab === "deposit") {
      const sig = await run(
        "deposit",
        () => (junior ? client.depositJunior(amountBase) : client.deposit(amountBase)),
        junior ? t("Aporte na classe júnior realizado", "Junior tranche deposit completed") : t("Liquidez aportada no pool", "Liquidity added to the pool"),
      );
      if (sig) setAmount("");
    } else {
      // passo 1: pedir o saque (converte o valor desejado em cotas)
      const shares = Math.min(classShares, Math.floor(amountBase / price));
      const sig = await run(
        "withdraw",
        () => (junior ? client.requestJuniorWithdraw(shares) : client.requestWithdraw(shares)),
        t(
          `Saque pedido: liberado em ${fmtDuration(pool.params.withdrawNoticeSecs)}`,
          `Withdrawal requested: available in ${fmtDuration(pool.params.withdrawNoticeSecs)}`,
        ),
      );
      if (sig) setAmount("");
    }
  };

  // passo 2: executar o saque pedido, apos o aviso previo
  const execute = () => {
    const shares = Math.min(pendingShares, classShares);
    return run(
      "execute",
      () => (junior ? client.withdrawJunior(shares) : client.withdraw(shares)),
      t("Saque realizado", "Withdrawal completed"),
    );
  };

  const invalid =
    amountBase <= 0 ||
    (tab === "deposit" ? amountBase > balance || (junior && juniorWiped) : amountBase > classValue + 1);

  const segBtn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${active ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"}`;

  return (
    <div>
      <PageHeader
        title={t("Pool de risco & staking", "Risk pool & staking")}
        subtitle={t(
          "Aporte stablecoin em uma das duas classes de cotas e seja remunerado pelos prêmios das apólices.",
          "Deposit stablecoins into one of two share classes and earn from policy premiums.",
        )}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t("Capital no cofre", "Vault capital")}
          value={fmtMoney(pool.vaultBalance)}
          hint={`${pool.activePolicies} ${t("apólices ativas", "active policies")}`}
        />
        <Stat
          label={t("Patrimônio dos cotistas", "Shareholder equity")}
          value={fmtMoney(nav)}
          hint={`${t("Júnior", "Junior")} ${fmtPct(nav ? juniorNav / nav : 0)}`}
        />
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

      <section className="card mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Layers className="size-5 text-[var(--accent)]" /> {t("Classes de cotas", "Share classes")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{t("Sênior", "Senior")}</p>
              <p className="num text-sm text-[var(--muted)]">
                {t("Cota", "Share")} {fmtNum(seniorPrice, 4)}
              </p>
            </div>
            <p className="num mt-1 text-2xl font-bold">{fmtMoney(seniorNav)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t(
                `Protegida: só perde depois que a júnior for zerada. Recebe ${fmtPct(1 - juniorIncomeShare)} da receita dos cotistas hoje.`,
                `Protected: only loses after the junior is wiped out. Receives ${fmtPct(1 - juniorIncomeShare)} of shareholder income today.`,
              )}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{t("Júnior (primeira perda)", "Junior (first loss)")}</p>
              <p className="num text-sm text-[var(--muted)]">
                {t("Cota", "Share")} {fmtNum(juniorPrice, 4)}
              </p>
            </div>
            <p className="num mt-1 text-2xl font-bold">{fmtMoney(juniorNav)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t(
                `Absorve os sinistros primeiro e, em troca, cada real pesa ${fmtNum(juniorWeight, 1)}x na divisão dos prêmios (${fmtPct(juniorIncomeShare)} da receita hoje). Colchão de ${fmtPct(cushion)} da cobertura ativa.`,
                `Absorbs claims first and, in return, each unit weighs ${fmtNum(juniorWeight, 1)}x in premium sharing (${fmtPct(juniorIncomeShare)} of income today). Cushion of ${fmtPct(cushion)} of active coverage.`,
              )}
            </p>
          </div>
        </div>
      </section>

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
            <Row label={t("Garantias dos avaliadores", "Assessor bonds")} value={fmtMoney(pool.assessorBonds)} />
            <Row label={t("Sinistros pendentes", "Pending claims")} value={fmtMoney(pool.pendingClaims)} />
            <Row label={t("Prêmios arrecadados", "Premiums collected")} value={fmtMoney(pool.totalPremiums)} />
            <Row label={t("Salvados recuperados", "Salvage recovered")} value={fmtMoney(pool.totalSalvage)} />
            <Row
              label={t(
                `Taxa do protocolo (${pool.params.protocolFeeBps / 100}% do prêmio)`,
                `Protocol fee (${pool.params.protocolFeeBps / 100}% of premium)`,
              )}
              value={fmtMoney(pool.totalProtocolFees)}
            />
            <Row label={t("Pago a avaliadores", "Paid to assessors")} value={fmtMoney(pool.totalAssessorRewards)} />
            <Row label={t("Cashback devolvido", "Cashback returned")} value={fmtMoney(pool.totalCashbackPaid)} />
            <Row label={t("Carência de saque", "Withdrawal cooldown")} value={fmtDuration(pool.params.withdrawCooldownSecs)} />
            <Row label={t("Aviso prévio de saque", "Withdrawal notice")} value={fmtDuration(pool.params.withdrawNoticeSecs)} />
            <Row
              label={t("Cobertura máxima por apólice", "Maximum coverage per policy")}
              value={`${fmtMoney(Math.floor((nav * pool.params.maxPolicyCoverageBps) / 10_000))} (${pool.params.maxPolicyCoverageBps / 100}% ${t("do patrimônio", "of equity")})`}
            />
            <Row label={t("Avaliadores", "Assessors")} value={`${pool.approvalThreshold} ${t("de", "of")} ${pool.assessors.length}`} />
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
                  label={t("Cotas sênior", "Senior shares")}
                  value={`${fmtNum(seniorShares / UNIT)} · ${fmtMoney(seniorValue)}`}
                />
                <Row
                  label={t("Cotas júnior", "Junior shares")}
                  value={`${fmtNum(juniorShares / UNIT)} · ${fmtMoney(juniorValue)}`}
                />
                <Row label={t("Total aportado", "Total deposited")} value={fmtMoney(stake?.totalDeposited ?? 0)} />
                <Row label={t("Total sacado", "Total withdrawn")} value={fmtMoney(stake?.totalWithdrawn ?? 0)} />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold">
                <button onClick={() => setCls("senior")} className={segBtn(cls === "senior")}>
                  {t("Sênior", "Senior")}
                </button>
                <button onClick={() => setCls("junior")} className={segBtn(cls === "junior")}>
                  {t("Júnior", "Junior")}
                </button>
              </div>
              <div className="mt-2 flex rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold">
                <button onClick={() => setTab("deposit")} className={segBtn(tab === "deposit")}>
                  <ArrowDownToLine className="size-4" /> {t("Aportar", "Deposit")}
                </button>
                <button onClick={() => setTab("withdraw")} className={segBtn(tab === "withdraw")}>
                  <ArrowUpFromLine className="size-4" /> {t("Sacar", "Withdraw")}
                </button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="amt">
                    {t("Valor", "Amount")}
                  </label>
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
                {tab === "deposit" && junior && juniorWiped && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-[var(--bad)]">
                    <Info className="size-3.5" />{" "}
                    {t(
                      "A classe júnior foi zerada por sinistros; novos aportes aguardam a recomposição pela governança.",
                      "The junior tranche was wiped out by claims; new deposits await recapitalization by governance.",
                    )}
                  </p>
                )}
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
                    ? junior
                      ? t("Aportar na júnior", "Deposit into junior")
                      : t("Aportar na sênior", "Deposit into senior")
                    : pendingShares > 0
                      ? t("Refazer pedido de saque", "Update withdrawal request")
                      : t("Pedir saque", "Request withdrawal")}
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {junior
                    ? t(
                        "Maior retorno, maior risco: os sinistros pagos saem primeiro desta classe. Salvados recuperados voltam aos cotistas.",
                        "Higher return, higher risk: paid claims come out of this class first. Recovered salvage returns to shareholders.",
                      )
                    : t(
                        "Retorno menor e mais estável: a classe júnior absorve as perdas antes. O valor da cota sobe quando prêmios superam indenizações.",
                        "Lower, steadier return: the junior class absorbs losses first. The share price rises when premiums exceed payouts.",
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
