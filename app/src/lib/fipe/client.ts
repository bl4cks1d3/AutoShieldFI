// Cliente do navegador para as rotas /api/fipe e /api/placa deste app.

import type { FipeOption, FipeQuote, PlateLookup, VehicleType } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Falha na consulta (${res.status})`);
  return body as T;
}

const seg = encodeURIComponent;

export const fipeApi = {
  status: () => get<{ modelo: boolean; placa: boolean }>("/fipe/status"),

  brands: (tipo: VehicleType) => get<FipeOption[]>(`/fipe/${tipo}/marcas`),
  models: (tipo: VehicleType, marca: string) => get<FipeOption[]>(`/fipe/${tipo}/marcas/${seg(marca)}/modelos`),
  years: (tipo: VehicleType, marca: string, modelo: string) =>
    get<FipeOption[]>(`/fipe/${tipo}/marcas/${seg(marca)}/modelos/${seg(modelo)}/anos`),
  price: (tipo: VehicleType, marca: string, modelo: string, ano: string) =>
    get<FipeQuote>(`/fipe/${tipo}/marcas/${seg(marca)}/modelos/${seg(modelo)}/anos/${seg(ano)}`),

  yearsByCode: (tipo: VehicleType, codigo: string) => get<FipeOption[]>(`/fipe/${tipo}/codigo/${seg(codigo)}/anos`),
  priceByCode: (tipo: VehicleType, codigo: string, ano: string) =>
    get<FipeQuote>(`/fipe/${tipo}/codigo/${seg(codigo)}/anos/${seg(ano)}`),

  plate: (placa: string) => get<PlateLookup>(`/placa/${seg(placa)}`),
};
