import "server-only";
import { parseBRL, type FipeQuote, type PlateLookup, type VehicleType } from "../types";
import { FipeError, parallelum } from "./parallelum";

// Consulta de veiculo por placa. Nao existe API publica gratuita para isso no Brasil
// (os dados vem do Denatran/Senatran via provedores pagos). O provedor padrao e o
// WDAPI2 (https://apiplacas.com.br), que tambem devolve as versoes FIPE compativeis.
//
//   PLACA_API_TOKEN=<token>                       obrigatorio
//   PLACA_API_URL=https://wdapi2.com.br/consulta  opcional

const BASE = process.env.PLACA_API_URL ?? "https://wdapi2.com.br/consulta";
const TTL_MS = 24 * 60 * 60 * 1000;

// Cada consulta e cobrada pelo provedor: guarda o resultado em memoria por 24h.
const cache = new Map<string, { at: number; data: PlateLookup }>();

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function tipoFrom(tipoModelo: unknown): VehicleType {
  // FIPE: 1 = carro, 2 = moto, 3 = caminhao
  return Number(tipoModelo) === 2 ? "motos" : Number(tipoModelo) === 3 ? "caminhoes" : "carros";
}

function fipeFromProvider(raw: Raw): FipeQuote[] {
  const dados = ((raw.fipe as Raw | undefined)?.dados ?? []) as Raw[];
  return dados
    .slice()
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .map((d) => ({
      tipo: tipoFrom(d.tipo_modelo),
      codigoFipe: String(d.codigo_fipe ?? ""),
      marca: String(d.texto_marca ?? raw.MARCA ?? ""),
      modelo: String(d.texto_modelo ?? raw.MODELO ?? ""),
      anoModelo: int(d.ano_modelo) ?? int(raw.anoModelo) ?? new Date().getFullYear(),
      combustivel: String(d.combustivel ?? ""),
      valor: parseBRL(String(d.texto_valor ?? "")),
      valorTexto: String(d.texto_valor ?? ""),
      mesReferencia: String(d.mes_referencia ?? ""),
    }))
    .filter((q) => q.codigoFipe && q.valor > 0);
}

/** Atualiza o preco pelo codigo FIPE no mes corrente (o provedor pode estar defasado). */
async function refreshPrice(q: FipeQuote): Promise<FipeQuote> {
  try {
    const years = await parallelum.yearsByCode(q.tipo, q.codigoFipe);
    const year = years.find((y) => y.codigo.startsWith(`${q.anoModelo}-`)) ?? years[0];
    return year ? await parallelum.priceByCode(q.tipo, q.codigoFipe, year.codigo) : q;
  } catch {
    return q;
  }
}

export function plateLookupConfigured(): boolean {
  return !!process.env.PLACA_API_TOKEN;
}

export async function lookupPlate(placa: string): Promise<PlateLookup> {
  const hit = cache.get(placa);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const token = process.env.PLACA_API_TOKEN;
  if (!token)
    throw new FipeError("Consulta por placa não configurada no servidor (defina PLACA_API_TOKEN)", 503);

  const res = await fetch(`${BASE}/${placa}/${token}`, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new FipeError("Token da API de placas inválido", 502);
  if (res.status === 402) throw new FipeError("Créditos da API de placas esgotados", 502);
  if (res.status === 404 || res.status === 406) throw new FipeError("Placa não encontrada", 404);
  if (res.status === 429) throw new FipeError("Limite de consultas por placa atingido", 429);
  if (!res.ok) throw new FipeError(`Serviço de placas indisponível (${res.status})`);

  const raw = (await res.json()) as Raw;
  if (str(raw.message) && !raw.MARCA && !raw.marca) throw new FipeError(String(raw.message), 404);

  const fipe = await Promise.all(fipeFromProvider(raw).slice(0, 5).map(refreshPrice));
  const data: PlateLookup = {
    placa,
    marca: str(raw.MARCA) ?? str(raw.marca) ?? "",
    modelo: str(raw.MODELO) ?? str(raw.modelo) ?? "",
    anoFabricacao: int(raw.ano),
    anoModelo: int(raw.anoModelo),
    cor: str(raw.cor),
    municipio: str(raw.municipio),
    uf: str(raw.uf),
    fipe,
  };
  cache.set(placa, { at: Date.now(), data });
  return data;
}
