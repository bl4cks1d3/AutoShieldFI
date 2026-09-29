"use client";

import { Car, Check, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { FipeLookup } from "@/components/FipeLookup";
import { PlateStatus, usePlateAutofill } from "@/components/PlateAutofill";
import { Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { normalizePlate, PLATE_RE, PRESETS } from "@/lib/fipe";
import { fmtDuration, fmtInput, fmtMoney, toBase } from "@/lib/format";
import { kindLabel, tierDesc, tierLabel, useI18n } from "@/lib/i18n";
import {
  installmentAmount,
  installmentOptions,
  MAX_DAYS,
  MIN_DAYS,
  quote,
  splitPayment,
  TIER_COVERS,
  TIER_MULTIPLIER,
} from "@/lib/pricing";
import type { Tier } from "@/lib/types";

export default function CotarPage() {
  const router = useRouter();
  const { client } = useApp();
  const { data: pool, loading } = useData((c) => c.getPool());
  const { data: balance } = useData((c) => (c.wallet ? c.getBalance(c.wallet) : Promise.resolve(0)), [client.wallet]);
  const { run, busy } = useAction();
  const { lang, t } = useI18n();

  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 2);
  const [value, setValue] = useState("");
  const [tier, setTier] = useState<Tier>("standard");
  const [days, setDays] = useState(365);
  const [installments, setInstallments] = useState(12);
  const [fipeOpen, setFipeOpen] = useState(false);
  // Placa valida digitada -> busca o veiculo e preenche modelo, ano e valor FIPE.
  const plateState = usePlateAutofill(plate, (q) => {
    setModel(`${q.marca.split(" - ")[0]} ${q.modelo}`.slice(0, 48));
    setYear(q.anoModelo);
    setValue(fmtInput(q.valor));
  });

  if (loading) return <Loading />;
  if (!pool) return <PoolMissing />;

  const vehicleValue = toBase(value);
  const q = quote(pool.params, vehicleValue, tier, days);
  const plateNorm = normalizePlate(plate);
  const plateOk = PLATE_RE.test(plateNorm);
  const options = installmentOptions(days);
  const n = Math.min(installments, options.length);
  const first = installmentAmount(q.premium, n, 1);
  const payToday = first + pool.params.inspectionFee;
  const split = splitPayment(pool.params, first);
  const freeCapital =
    pool.vaultBalance - pool.reservedCashback - pool.treasuryAccrued - pool.pendingInspectionFees;
  const required =
    ((pool.totalActiveCoverage + vehicleValue) * pool.params.minCollateralBps) / 10_000 + pool.pendingClaims;
  const capacityOk = freeCapital + split.toPool >= required;
  const maxCoverage = Math.floor(((freeCapital + split.toPool) * pool.params.maxPolicyCoverageBps) / 10_000);
  const exposureOk = q.coverageLimit <= maxCoverage;
  const valueOk = vehicleValue >= pool.params.minVehicleValue;
  const canBuy =
    plateOk && model.trim().length > 1 && valueOk && q.premium >= n && (balance ?? 0) >= payToday && capacityOk && exposureOk;

  const buy = async () => {
    const sig = await run(
      "buy",
      () =>
        client.purchase({
          plate: plateNorm,
          model: model.trim().slice(0, 48),
          year,
          vehicleValue,
          tier,
          durationDays: days,
          installments: n,
          maxPremium: Math.ceil(q.premium * 1.01),
        }),
      t("Apólice contratada!", "Policy purchased!"),
    );
    if (sig) router.push("/apolices");
  };

  return (
    <div>
      <PageHeader
        title={t("Contratar proteção", "Get covered")}
        subtitle={t(
          "Prêmio calculado on-chain a partir do valor FIPE, plano e vigência.",
          "Premium calculated on-chain from the FIPE value, plan and term.",
        )}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Car className="size-5 text-[var(--accent)]" /> {t("Veículo", "Vehicle")}
              </h2>
              <button className="text-sm font-semibold text-[var(--accent)] hover:underline" onClick={() => setFipeOpen(!fipeOpen)}>
                <Search className="mr-1 inline size-3.5" />
                {fipeOpen ? t("Fechar consulta FIPE", "Close FIPE lookup") : t("Consultar tabela FIPE", "Look up FIPE price")}
              </button>
            </div>

            {fipeOpen && (
              <FipeLookup
                initialPlate={plate}
                onPick={(p) => {
                  if (p.placa) setPlate(p.placa);
                  setModel(p.modelo);
                  setYear(p.ano);
                  setValue(fmtInput(p.valor));
                  setFipeOpen(false);
                }}
              />
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.model}
                  className="chip border border-[var(--border)] bg-[var(--bg)] py-1 text-[var(--fg)] hover:border-[var(--accent)]"
                  onClick={() => {
                    setModel(p.model);
                    setYear(p.year);
                    setValue(String(p.value));
                  }}
                >
                  {p.model} {p.year}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="plate">{t("Placa (Mercosul ou antiga)", "License plate (Mercosur or old format)")}</label>
                <input
                  id="plate"
                  className="input uppercase"
                  placeholder="ABC1D23"
                  maxLength={8}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
                {plate && !plateOk && <p className="mt-1 text-xs text-[var(--bad)]">{t("Formato inválido (ex.: ABC1D23)", "Invalid format (e.g. ABC1D23)")}</p>}
                <PlateStatus state={plateState} onMoreVersions={() => setFipeOpen(true)} />
              </div>
              <div>
                <label className="label" htmlFor="year">{t("Ano do modelo", "Model year")}</label>
                <input
                  id="year"
                  type="number"
                  className="input"
                  min={1950}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="model">{t("Marca / modelo", "Make / model")}</label>
                <input
                  id="model"
                  className="input"
                  placeholder={t("Ex.: VW Gol 1.0", "e.g. VW Gol 1.0")}
                  maxLength={48}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="value">{t("Valor FIPE (R$)", "FIPE value (R$)")}</label>
                <input
                  id="value"
                  className="input num"
                  inputMode="decimal"
                  placeholder="50000"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
                />
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5 text-[var(--accent)]" /> {t("Plano de cobertura", "Coverage plan")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["basic", "standard", "premium"] as Tier[]).map((tr) => (
                <button
                  key={tr}
                  onClick={() => setTier(tr)}
                  className={`rounded-xl border p-4 text-left transition ${
                    tier === tr ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{tierLabel(tr, lang)}</p>
                    <span className="text-xs text-[var(--muted)]">×{(TIER_MULTIPLIER[tr] / 100).toFixed(1)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{tierDesc(tr, lang)}</p>
                  <ul className="mt-3 space-y-1">
                    {TIER_COVERS[tr].map((k) => (
                      <li key={k} className="flex items-center gap-1.5 text-xs">
                        <Check className="size-3.5 text-[var(--ok)]" /> {kindLabel(k, lang)}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="label !mb-0" htmlFor="days">{t("Vigência", "Term")}</label>
                <span className="num font-semibold">{days} {t("dias", "days")}</span>
              </div>
              <input
                id="days"
                type="range"
                min={MIN_DAYS}
                max={MAX_DAYS}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
              <div className="mt-2 flex gap-2">
                {[30, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`chip border py-1 ${days === d ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
                  >
                    {d === 365 ? t("1 ano", "1 year") : `${d} ${t("dias", "days")}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="label">{t("Pagamento", "Payment")}</span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 12].filter((k) => options.includes(k)).map((k) => (
                  <button
                    key={k}
                    onClick={() => setInstallments(k)}
                    className={`chip border py-1.5 ${n === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}
                  >
                    {k === 1 ? t("À vista", "Upfront") : t(`${k}x sem juros`, `${k}x interest-free`)}
                  </button>
                ))}
              </div>
              {n > 1 && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t(
                    `Parcelas a cada ${Math.round(days / n)} dias. Com parcela atrasada além da tolerância de ${fmtDuration(pool.params.installmentGraceSecs)}, a apólice caduca e perde o cashback.`,
                    `Installments every ${Math.round(days / n)} days. If an installment is late beyond the ${fmtDuration(pool.params.installmentGraceSecs)} grace period, the policy lapses and loses the cashback.`,
                  )}
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="card p-5">
            <h2 className="font-semibold">{t("Resumo da cotação", "Quote summary")}</h2>
            <div className="mt-3 divide-y divide-[var(--border)] text-sm">
              <Row label={t("Cobertura (valor FIPE)", "Coverage (FIPE value)")} value={fmtMoney(q.coverageLimit)} />
              <Row label={t("Taxa base anual", "Annual base rate")} value={`${(pool.params.baseRateBps / 100).toFixed(2)}%`} />
              <Row label={`${t("Plano", "Plan")} ${tierLabel(tier, lang)}`} value={`×${(TIER_MULTIPLIER[tier] / 100).toFixed(1)}`} />
              <Row label={t("Franquia (danos parciais)", "Deductible (partial damage)")} value={fmtMoney(q.deductible)} />
              <Row label={t("Prêmio total", "Total premium")} value={fmtMoney(q.premium)} strong />
              {n > 1 ? (
                <Row label={t(`${n} parcelas de`, `${n} installments of`)} value={fmtMoney(first)} />
              ) : (
                <Row label={t("Equivalente mensal", "Monthly equivalent")} value={fmtMoney(q.monthlyEquivalent)} />
              )}
              <Row label={t("Taxa de vistoria (única)", "Inspection fee (one-time)")} value={fmtMoney(pool.params.inspectionFee)} />
              <Row
                label={`${t("Cashback sem sinistro", "Cashback with no claims")} (${pool.params.cashbackBps / 100}%)`}
                value={<span className="text-[var(--ok)]">+{fmtMoney(q.cashback)}</span>}
              />
              <Row label={t("Custo líquido sem sinistro", "Net cost with no claims")} value={fmtMoney(q.netCost)} strong />
              <Row label={t("Pago hoje", "Paid today")} value={fmtMoney(payToday)} strong />
            </div>

            <div className="mt-4">
              <WalletGate>
                <button className="btn btn-primary w-full" disabled={!canBuy || !!busy} onClick={buy}>
                  {busy === "buy" && <Spinner />} {n > 1
                    ? `${t("Contratar: 1ª parcela", "Buy: 1st installment")} ${fmtMoney(payToday)}`
                    : `${t("Contratar por", "Buy for")} ${fmtMoney(payToday)}`}
                </button>
                <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                  {vehicleValue > 0 && !exposureOk && (
                    <p className="text-[var(--warn)]">
                      {t("Cobertura acima do limite por apólice do pool", "Coverage above the pool's per-policy limit")} (
                      {fmtMoney(maxCoverage)}). {t("Aguarde mais liquidez.", "Wait for more liquidity.")}
                    </p>
                  )}
                  {vehicleValue > 0 && !valueOk && (
                    <p className="text-[var(--warn)]">
                      {t("Valor FIPE mínimo", "Minimum FIPE value")}: {fmtMoney(pool.params.minVehicleValue)}.
                    </p>
                  )}
                  {(balance ?? 0) < payToday && q.premium > 0 && (
                    <p className="text-[var(--warn)]">
                      {t("Saldo insuficiente", "Insufficient balance")} ({fmtMoney(balance ?? 0)}).{" "}
                      {t("Use o faucet no Início.", "Use the faucet on the Home page.")}
                    </p>
                  )}
                  {!capacityOk && vehicleValue > 0 && (
                    <p className="text-[var(--warn)]">
                      {t("O pool não tem capital livre para esta cobertura agora.", "The pool has no free capital for this coverage right now.")}{" "}
                      <Link href="/pool" className="underline">{t("Aporte liquidez", "Provide liquidity")}</Link>.
                    </p>
                  )}
                  <p>
                    {t(
                      "O prêmio é transferido para o cofre do pool de risco e a apólice é registrada on-chain.",
                      "The premium is transferred to the risk pool vault and the policy is recorded on-chain.",
                    )}
                  </p>
                  <p>
                    {t(
                      `Antes de cobrir sinistros, a apólice passa por vistoria de um avaliador (recusada = prêmio devolvido) e por carência de ${fmtDuration(pool.params.claimWaitingSecs)}. Cada placa só pode ter uma apólice ativa.`,
                      `Before covering claims, the policy goes through an assessor inspection (rejected = premium refunded) and a ${fmtDuration(pool.params.claimWaitingSecs)} waiting period. Each plate can only have one active policy.`,
                    )}
                  </p>
                </div>
              </WalletGate>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
