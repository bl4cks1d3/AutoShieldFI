"use client";

import { CarFront, Hash, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fipeApi,
  normalizePlate,
  PLATE_RE,
  VEHICLE_TYPES,
  type FipeOption,
  type FipeQuote,
  type PlateLookup,
  type VehicleType,
} from "@/lib/fipe";
import { Spinner } from "./ui";

export interface FipePick {
  placa?: string;
  modelo: string;
  ano: number;
  valor: number;
  codigoFipe: string;
}

type Tab = "placa" | "modelo";

/** Consulta FIPE por placa ou por marca/modelo/ano. */
export function FipeLookup({ initialPlate = "", onPick }: { initialPlate?: string; onPick: (p: FipePick) => void }) {
  const [tab, setTab] = useState<Tab>("placa");
  const [plateEnabled, setPlateEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fipeApi
      .status()
      .then((s) => {
        setPlateEnabled(s.placa);
        if (!s.placa) setTab("modelo");
      })
      .catch(() => setPlateEnabled(false));
  }, []);

  const pick = (q: FipeQuote, placa?: string) =>
    onPick({
      placa,
      modelo: `${q.marca.split(" - ")[0]} ${q.modelo}`.slice(0, 48),
      ano: q.anoModelo,
      valor: q.valor,
      codigoFipe: q.codigoFipe,
    });

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
      <div className="mb-4 flex rounded-xl border border-[var(--border)] p-0.5 text-sm font-semibold">
        {(
          [
            { key: "placa", label: "Por placa", icon: Hash },
            { key: "modelo", label: "Por modelo", icon: CarFront },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 ${
              tab === t.key ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"
            }`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "placa" ? (
        <ByPlate enabled={plateEnabled} initialPlate={initialPlate} onPick={pick} />
      ) : (
        <ByModel onPick={(q) => pick(q)} />
      )}
    </div>
  );
}

function ByPlate({
  enabled,
  initialPlate,
  onPick,
}: {
  enabled: boolean | null;
  initialPlate: string;
  onPick: (q: FipeQuote, placa: string) => void;
}) {
  const [plate, setPlate] = useState(initialPlate);
  const [result, setResult] = useState<PlateLookup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const norm = normalizePlate(plate);
  const valid = PLATE_RE.test(norm);

  const search = async () => {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fipeApi.plate(norm);
      if (!r.fipe.length) throw new Error("Veículo encontrado, mas sem correspondência na tabela FIPE");
      setResult(r);
      if (r.fipe.length === 1) onPick(r.fipe[0], r.placa);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (enabled === false)
    return (
      <p className="text-sm text-[var(--muted)]">
        A consulta por placa não está configurada neste servidor (variável <code>PLACA_API_TOKEN</code>). Use a busca
        por modelo.
      </p>
    );

  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1 uppercase"
          placeholder="ABC1D23"
          maxLength={8}
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && search()}
          aria-label="Placa"
        />
        <button className="btn btn-primary" disabled={!valid || loading || enabled === null} onClick={search}>
          {loading ? <Spinner /> : <Search className="size-4" />} Buscar
        </button>
      </div>
      {plate && !valid && <p className="mt-1 text-xs text-[var(--bad)]">Formato inválido (ex.: ABC1D23 ou ABC1234)</p>}
      {err && <p className="mt-3 text-sm text-[var(--warn)]">{err}</p>}

      {result && (
        <div className="mt-4">
          <p className="text-sm">
            <b>
              {result.marca} {result.modelo}
            </b>{" "}
            <span className="text-[var(--muted)]">
              · {result.anoFabricacao ?? "?"}/{result.anoModelo ?? "?"}
              {result.cor && ` · ${result.cor}`}
              {result.municipio && ` · ${result.municipio}/${result.uf}`}
            </span>
          </p>
          <p className="mt-3 text-xs font-semibold uppercase text-[var(--muted)]">Escolha a versão FIPE</p>
          <QuoteList quotes={result.fipe} onPick={(q) => onPick(q, result.placa)} />
        </div>
      )}
    </div>
  );
}

function ByModel({ onPick }: { onPick: (q: FipeQuote) => void }) {
  const [tipo, setTipo] = useState<VehicleType>("carros");
  const [brands, setBrands] = useState<FipeOption[]>([]);
  const [models, setModels] = useState<FipeOption[]>([]);
  const [years, setYears] = useState<FipeOption[]>([]);
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [yearId, setYearId] = useState("");
  const [quote, setQuote] = useState<FipeQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBrands([]);
    setBrand("");
    fipeApi.brands(tipo).then(setBrands).catch((e) => setErr(e.message));
  }, [tipo]);

  useEffect(() => {
    setModels([]);
    setModelId("");
    setModelFilter("");
    if (brand) fipeApi.models(tipo, brand).then(setModels).catch((e) => setErr(e.message));
  }, [tipo, brand]);

  useEffect(() => {
    setYears([]);
    setYearId("");
    setQuote(null);
    if (brand && modelId) fipeApi.years(tipo, brand, modelId).then(setYears).catch((e) => setErr(e.message));
  }, [tipo, brand, modelId]);

  useEffect(() => {
    setQuote(null);
    if (!yearId) return;
    setLoading(true);
    setErr(null);
    fipeApi
      .price(tipo, brand, modelId, yearId)
      .then(setQuote)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tipo, brand, modelId, yearId]);

  // Todas as palavras digitadas precisam aparecer no nome, em qualquer ordem.
  const terms = modelFilter.toLowerCase().split(/\s+/).filter(Boolean);
  const shownModels = terms.length
    ? models.filter((m) => terms.every((t) => m.nome.toLowerCase().includes(t)))
    : models;

  return (
    <div>
      {err && <p className="mb-3 text-sm text-[var(--warn)]">{err} — informe o valor manualmente.</p>}
      <div className="mb-3 flex gap-2">
        {VEHICLE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            className={`chip border py-1 ${
              tipo === t.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marca">
          <option value="">{brands.length ? "Marca…" : "Carregando marcas…"}</option>
          {brands.map((b) => (
            <option key={b.codigo} value={b.codigo}>
              {b.nome}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Filtrar modelo (ex.: Onix 1.0)"
          value={modelFilter}
          disabled={!models.length}
          onChange={(e) => setModelFilter(e.target.value)}
          aria-label="Filtrar modelo"
        />
        <select
          className="input"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={!models.length}
          aria-label="Modelo"
        >
          <option value="">{models.length ? `Modelo… (${shownModels.length})` : "Modelo…"}</option>
          {shownModels.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nome}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={yearId}
          onChange={(e) => setYearId(e.target.value)}
          disabled={!years.length}
          aria-label="Ano"
        >
          <option value="">Ano…</option>
          {years.map((y) => (
            <option key={y.codigo} value={y.codigo}>
              {y.nome.replace(/^32000/, "Zero km")}
            </option>
          ))}
        </select>
      </div>
      {loading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Spinner /> Consultando preço…
        </p>
      )}
      {quote && <QuoteList quotes={[quote]} onPick={onPick} />}
    </div>
  );
}

function QuoteList({ quotes, onPick }: { quotes: FipeQuote[]; onPick: (q: FipeQuote) => void }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {quotes.map((q) => (
        <button
          key={`${q.codigoFipe}-${q.anoModelo}`}
          onClick={() => onPick(q)}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-left hover:border-[var(--accent)]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{q.modelo}</p>
            <p className="text-xs text-[var(--muted)]">
              {q.anoModelo} · {q.combustivel} · FIPE {q.codigoFipe} · {q.mesReferencia}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="num font-bold">{q.valorTexto}</p>
            <p className="text-xs font-semibold text-[var(--accent)]">Usar este valor</p>
          </div>
        </button>
      ))}
    </div>
  );
}
