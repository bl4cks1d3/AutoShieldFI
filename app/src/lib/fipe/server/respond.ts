import "server-only";
import { NextResponse } from "next/server";
import { isVehicleType, type VehicleType } from "../types";
import { FipeError } from "./parallelum";

/** Executa o handler e converte erros em JSON { error } com o status adequado. */
export async function respond<T>(
  fn: () => Promise<T>,
  cacheControl = "public, max-age=3600, stale-while-revalidate=86400",
): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": cacheControl } });
  } catch (e) {
    const status = e instanceof FipeError ? e.status : 500;
    const error = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error }, { status });
  }
}

export function vehicleType(tipo: string): VehicleType {
  if (!isVehicleType(tipo)) throw new FipeError("Tipo de veículo inválido (use carros, motos ou caminhoes)", 400);
  return tipo;
}
