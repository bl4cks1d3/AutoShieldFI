"use client";

import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { fipeApi, normalizePlate, PLATE_RE, type FipeQuote, type PlateLookup } from "@/lib/fipe";
import { translateError, useI18n } from "@/lib/i18n";
import { Spinner } from "./ui";

export type PlateState =
  | { status: "idle" }
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "found"; result: PlateLookup; best: FipeQuote }
  | { status: "error"; error: string };

let enabledCache: Promise<boolean> | null = null;
function plateEnabled(): Promise<boolean> {
  enabledCache ??= fipeApi
    .status()
    .then((s) => s.placa)
    .catch(() => false);
  return enabledCache;
}

/**
 * Consulta automatica por placa: quando a placa digitada fica valida, busca o
 * veiculo e as versoes FIPE no servidor (/api/placa) e chama onFound com a mais provavel.
 */
export function usePlateAutofill(plate: string, onFound: (q: FipeQuote, placa: string) => void): PlateState {
  const [state, setState] = useState<PlateState>({ status: "idle" });
  const norm = normalizePlate(plate);

  useEffect(() => {
    if (!PLATE_RE.test(norm)) {
      setState({ status: "idle" });
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      if (!(await plateEnabled())) return alive && setState({ status: "disabled" });
      if (!alive) return;
      setState({ status: "loading" });
      try {
        const result = await fipeApi.plate(norm);
        if (!alive) return;
        const best = result.fipe[0];
        if (!best) throw new Error("Veículo encontrado, mas sem correspondência na tabela FIPE");
        setState({ status: "found", result, best });
        onFound(best, norm);
      } catch (e) {
        if (alive) setState({ status: "error", error: translateError((e as Error).message) });
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // onFound e estavel o suficiente; so a placa dispara nova consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [norm]);

  return state;
}

/** Linha de status exibida abaixo do campo de placa. */
export function PlateStatus({ state, onMoreVersions }: { state: PlateState; onMoreVersions: () => void }) {
  const { t } = useI18n();
  if (state.status === "idle") return null;
  if (state.status === "loading")
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <Spinner className="size-3.5" /> {t("Consultando placa e tabela FIPE…", "Looking up plate and FIPE table…")}
      </p>
    );
  if (state.status === "disabled")
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--warn)]">
        <AlertCircle className="mt-px size-3.5 flex-none" />
        <span>
          {t("Consulta automática por placa indisponível.", "Automatic plate lookup is unavailable.")}{" "}
          <button type="button" onClick={onMoreVersions} className="font-semibold text-[var(--accent)] hover:underline">
            {t("Buscar o valor FIPE por modelo", "Find the FIPE value by model")}
          </button>
        </span>
      </p>
    );
  if (state.status === "error")
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--warn)]">
        <AlertCircle className="mt-px size-3.5 flex-none" /> <span>{state.error}</span>
      </p>
    );
  const { result, best } = state;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ok)]">
      <CheckCircle2 className="size-3.5 flex-none" />
      <span>
        {result.marca} {result.modelo} · {best.anoModelo} · FIPE {best.valorTexto}
      </span>
      {result.fipe.length > 1 && (
        <button type="button" onClick={onMoreVersions} className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
          <Search className="size-3" /> {t(`outras ${result.fipe.length - 1} versões`, `${result.fipe.length - 1} other versions`)}
        </button>
      )}
    </p>
  );
}
