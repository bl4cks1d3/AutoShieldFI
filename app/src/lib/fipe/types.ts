// Tipos normalizados da tabela FIPE, compartilhados entre as rotas /api e a interface.

export type VehicleType = "carros" | "motos" | "caminhoes";

export const VEHICLE_TYPES: { key: VehicleType; label: string; en: string }[] = [
  { key: "carros", label: "Carro", en: "Car" },
  { key: "motos", label: "Moto", en: "Motorcycle" },
  { key: "caminhoes", label: "Caminhão", en: "Truck" },
];

export function isVehicleType(v: string): v is VehicleType {
  return v === "carros" || v === "motos" || v === "caminhoes";
}

/** Item de lista (marca, modelo ou ano). */
export interface FipeOption {
  codigo: string;
  nome: string;
}

/** Preco de um veiculo em um mes de referencia. */
export interface FipeQuote {
  tipo: VehicleType;
  codigoFipe: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  /** Valor em reais (ex.: 52345.5). */
  valor: number;
  valorTexto: string;
  mesReferencia: string;
}

/** Resultado da consulta por placa. */
export interface PlateLookup {
  placa: string;
  marca: string;
  modelo: string;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  municipio: string | null;
  uf: string | null;
  /** Versoes FIPE compativeis, da mais provavel para a menos provavel. */
  fipe: FipeQuote[];
}

export interface ApiError {
  error: string;
}

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23), sem separadores. */
export const PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "R$ 52.345,00" -> 52345 */
export function parseBRL(v: string): number {
  const n = Number(v.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
