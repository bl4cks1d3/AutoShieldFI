// Tabela FIPE e consulta por placa.
//
//   types.ts            tipos normalizados + utilitarios (placa, valores)
//   client.ts           chamadas do navegador para /api/fipe e /api/placa
//   server/parallelum   provedor FIPE (API publica v2)
//   server/placa        provedor de placas (WDAPI2, requer PLACA_API_TOKEN)
//   server/respond      padrao de resposta/erro das rotas

export * from "./types";
export { fipeApi } from "./client";

/** Veiculos populares para cotacao rapida (valores de referencia aproximados). */
export const PRESETS = [
  { model: "Fiat Mobi Like 1.0", year: 2022, value: 52_000 },
  { model: "VW Gol 1.0", year: 2020, value: 48_500 },
  { model: "Chevrolet Onix LT 1.0 Turbo", year: 2023, value: 89_900 },
  { model: "Hyundai HB20 Comfort 1.0", year: 2021, value: 67_300 },
  { model: "Toyota Corolla XEi 2.0", year: 2022, value: 138_000 },
  { model: "Honda CG 160 Fan (moto)", year: 2023, value: 16_900 },
];
