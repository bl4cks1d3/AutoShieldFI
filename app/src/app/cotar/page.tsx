"use client";

import { Car, Check, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction, useApp, useData } from "@/components/Providers";
import { FipeLookup } from "@/components/FipeLookup";
import { Loading, PageHeader, PoolMissing, Row, Spinner, WalletGate } from "@/components/ui";
import { normalizePlate, PLATE_RE, PRESETS } from "@/lib/fipe";
import { fmtMoney, KIND_LABEL, TIER_DESC, TIER_LABEL, toBase } from "@/lib/format";
import { MAX_DAYS, MIN_DAYS, quote, TIER_COVERS, TIER_MULTIPLIER } from "@/lib/pricing";
import type { Tier } from "@/lib/types";

export default function CotarPage() {
  const router = useRouter();
  const { client } = useApp();
  const { data: pool, loading } = useData((c) => c.getPool());
  const { data: balance } = useData((c) => (c.wallet ? c.getBalance(c.wallet) : Promise.resolve(0)), [client.wallet]);
  const { run, busy } = useAction();

  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 2);
  const [value, setValue] = useState("");
  const [tier, setTier] = useState<Tier>("standard");
  const [days, setDays] = useState(365);
  const [fipeOpen, setFipeOpen] = useState(false);

  if (loading) return <Loading />;
  if (!pool) return <PoolMissing />;

  const vehicleValue = toBase(value);
  const q = quote(pool.params, vehicleValue, tier, days);
  const plateNorm = normalizePlate(plate);
  const plateOk = PLATE_RE.test(plateNorm);
  const freeCapital = pool.vaultBalance - pool.reservedCashback;
  const required =
    ((pool.totalActiveCoverage + vehicleValue) * pool.params.minCollateralBps) / 10_000 + pool.pendingClaims;
  const capacityOk = freeCapital + q.premium - q.cashback >= required;
  const canBuy =
    plateOk && model.trim().length > 1 && vehicleValue > 0 && q.premium > 0 && (balance ?? 0) >= q.premium && capacityOk;

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
          maxPremium: Math.ceil(q.premium * 1.01),
        }),
      "Apólice contratada!",
    );
    if (sig) router.push("/apolices");
  };

  return (
    <div>
      <PageHeader
        title="Contratar proteção"
        subtitle="Prêmio calculado on-chain a partir do valor FIPE, plano e vigência."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Car className="size-5 text-[var(--accent)]" /> Veículo
              </h2>
              <button className="text-sm font-semibold text-[var(--accent)] hover:underline" onClick={() => setFipeOpen(!fipeOpen)}>
                <Search className="mr-1 inline size-3.5" />
                {fipeOpen ? "Fechar consulta FIPE" : "Consultar tabela FIPE"}
              </button>
            </div>

            {fipeOpen && (
              <FipeLookup
                initialPlate={plate}
                onPick={(p) => {
                  if (p.placa) setPlate(p.placa);
                  setModel(p.modelo);
                  setYear(p.ano);
                  setValue(String(p.valor).replace(".", ","));
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
                <label className="label" htmlFor="plate">Placa (Mercosul ou antiga)</label>
                <input
                  id="plate"
                  className="input uppercase"
                  placeholder="ABC1D23"
                  maxLength={8}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
                {plate && !plateOk && <p className="mt-1 text-xs text-[var(--bad)]">Formato inválido (ex.: ABC1D23)</p>}
              </div>
              <div>
                <label className="label" htmlFor="year">Ano do modelo</label>
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
                <label className="label" htmlFor="model">Marca / modelo</label>
                <input
                  id="model"
                  className="input"
                  placeholder="Ex.: VW Gol 1.0"
                  maxLength={48}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="value">Valor FIPE (R$)</label>
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
              <ShieldCheck className="size-5 text-[var(--accent)]" /> Plano de cobertura
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["basic", "standard", "premium"] as Tier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-xl border p-4 text-left transition ${
                    tier === t ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{TIER_LABEL[t]}</p>
                    <span className="text-xs text-[var(--muted)]">×{(TIER_MULTIPLIER[t] / 100).toFixed(1)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{TIER_DESC[t]}</p>
                  <ul className="mt-3 space-y-1">
                    {TIER_COVERS[t].map((k) => (
                      <li key={k} className="flex items-center gap-1.5 text-xs">
                        <Check className="size-3.5 text-[var(--ok)]" /> {KIND_LABEL[k]}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="label !mb-0" htmlFor="days">Vigência</label>
                <span className="num font-semibold">{days} dias</span>
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
                    {d === 365 ? "1 ano" : `${d} dias`}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="card p-5">
            <h2 className="font-semibold">Resumo da cotação</h2>
            <div className="mt-3 divide-y divide-[var(--border)] text-sm">
              <Row label="Cobertura (valor FIPE)" value={fmtMoney(q.coverageLimit)} />
              <Row label="Taxa base anual" value={`${(pool.params.baseRateBps / 100).toFixed(2)}%`} />
              <Row label={`Plano ${TIER_LABEL[tier]}`} value={`×${(TIER_MULTIPLIER[tier] / 100).toFixed(1)}`} />
              <Row label="Franquia (danos parciais)" value={fmtMoney(q.deductible)} />
              <Row label="Prêmio total" value={fmtMoney(q.premium)} strong />
              <Row label="Equivalente mensal" value={fmtMoney(q.monthlyEquivalent)} />
              <Row
                label={`Cashback sem sinistro (${pool.params.cashbackBps / 100}%)`}
                value={<span className="text-[var(--ok)]">+{fmtMoney(q.cashback)}</span>}
              />
              <Row label="Custo líquido sem sinistro" value={fmtMoney(q.netCost)} strong />
            </div>

            <div className="mt-4">
              <WalletGate>
                <button className="btn btn-primary w-full" disabled={!canBuy || !!busy} onClick={buy}>
                  {busy === "buy" && <Spinner />} Contratar por {fmtMoney(q.premium)}
                </button>
                <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                  {(balance ?? 0) < q.premium && q.premium > 0 && (
                    <p className="text-[var(--warn)]">
                      Saldo insuficiente ({fmtMoney(balance ?? 0)}). Use o faucet no topo da página.
                    </p>
                  )}
                  {!capacityOk && vehicleValue > 0 && (
                    <p className="text-[var(--warn)]">
                      O pool não tem capital livre para esta cobertura agora.{" "}
                      <Link href="/pool" className="underline">Aporte liquidez</Link>.
                    </p>
                  )}
                  <p>O prêmio é transferido para o cofre do pool de risco e a apólice é registrada on-chain.</p>
                </div>
              </WalletGate>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
