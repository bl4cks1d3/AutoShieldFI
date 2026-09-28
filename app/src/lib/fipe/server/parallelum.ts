import "server-only";
import { parseBRL, type FipeOption, type FipeQuote, type VehicleType } from "../types";

// Provedor da tabela FIPE: API publica FIPE v2 (https://deividfortuna.github.io/fipe/v2/).
// Sem token o limite e de ~1000 requisicoes/dia; defina FIPE_API_TOKEN para aumentar.

const BASE = process.env.FIPE_API_URL ?? "https://fipe.parallelum.com.br/api/v2";
const TYPE_PATH: Record<VehicleType, string> = { carros: "cars", motos: "motorcycles", caminhoes: "trucks" };

// A tabela e atualizada mensalmente: 12h de cache e suficiente.
const REVALIDATE = 60 * 60 * 12;

export class FipeError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const token = process.env.FIPE_API_TOKEN;
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { "X-Subscription-Token": token } : undefined,
    next: { revalidate: REVALIDATE },
  });
  if (res.status === 404) throw new FipeError("Veículo não encontrado na tabela FIPE", 404);
  if (res.status === 429) throw new FipeError("Limite de consultas FIPE atingido, tente mais tarde", 429);
  if (!res.ok) throw new FipeError(`Tabela FIPE indisponível (${res.status})`);
  return res.json() as Promise<T>;
}

type RawOption = { code: string; name: string };
type RawPrice = {
  price: string;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  codeFipe: string;
  referenceMonth: string;
};

const toOptions = (list: RawOption[]): FipeOption[] => list.map((o) => ({ codigo: o.code, nome: o.name }));

function toQuote(tipo: VehicleType, r: RawPrice): FipeQuote {
  return {
    tipo,
    codigoFipe: r.codeFipe,
    marca: r.brand,
    modelo: r.model,
    // 32000 = "zero km" na FIPE
    anoModelo: r.modelYear > 3000 ? new Date().getFullYear() : r.modelYear,
    combustivel: r.fuel,
    valor: parseBRL(r.price),
    valorTexto: r.price,
    mesReferencia: r.referenceMonth,
  };
}

const seg = encodeURIComponent;

export const parallelum = {
  brands: async (t: VehicleType) => toOptions(await get<RawOption[]>(`/${TYPE_PATH[t]}/brands`)),

  models: async (t: VehicleType, brand: string) =>
    toOptions(await get<RawOption[]>(`/${TYPE_PATH[t]}/brands/${seg(brand)}/models`)),

  years: async (t: VehicleType, brand: string, model: string) =>
    toOptions(await get<RawOption[]>(`/${TYPE_PATH[t]}/brands/${seg(brand)}/models/${seg(model)}/years`)),

  price: async (t: VehicleType, brand: string, model: string, year: string) =>
    toQuote(t, await get<RawPrice>(`/${TYPE_PATH[t]}/brands/${seg(brand)}/models/${seg(model)}/years/${seg(year)}`)),

  yearsByCode: async (t: VehicleType, fipeCode: string) =>
    toOptions(await get<RawOption[]>(`/${TYPE_PATH[t]}/${seg(fipeCode)}/years`)),

  priceByCode: async (t: VehicleType, fipeCode: string, year: string) =>
    toQuote(t, await get<RawPrice>(`/${TYPE_PATH[t]}/${seg(fipeCode)}/years/${seg(year)}`)),
};
