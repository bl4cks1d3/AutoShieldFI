// Consulta a tabela FIPE via API publica (parallelum). Em caso de falha,
// a interface permite informar o valor manualmente.

const BASE = "https://parallelum.com.br/fipe/api/v1/carros";

export interface FipeItem {
  codigo: string;
  nome: string;
}

export interface FipeResult {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`FIPE indisponível (${res.status})`);
  return res.json() as Promise<T>;
}

export const fipe = {
  brands: () => get<FipeItem[]>("/marcas"),
  models: async (brand: string) => (await get<{ modelos: FipeItem[] }>(`/marcas/${brand}/modelos`)).modelos,
  years: (brand: string, model: string) => get<FipeItem[]>(`/marcas/${brand}/modelos/${model}/anos`),
  price: (brand: string, model: string, year: string) =>
    get<FipeResult>(`/marcas/${brand}/modelos/${model}/anos/${year}`),
};

/** "R$ 52.345,00" -> 52345 */
export function parseFipeValue(v: string): number {
  return Number(v.replace(/[^\d,]/g, "").replace(",", "."));
}

/** Veiculos populares para cotacao rapida (valores de referencia aproximados). */
export const PRESETS = [
  { model: "Fiat Mobi Like 1.0", year: 2022, value: 52_000 },
  { model: "VW Gol 1.0", year: 2020, value: 48_500 },
  { model: "Chevrolet Onix LT 1.0 Turbo", year: 2023, value: 89_900 },
  { model: "Hyundai HB20 Comfort 1.0", year: 2021, value: 67_300 },
  { model: "Toyota Corolla XEi 2.0", year: 2022, value: 138_000 },
  { model: "Honda CG 160 Fan (moto)", year: 2023, value: 16_900 },
];
