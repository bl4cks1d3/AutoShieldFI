import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/marcas/{marca}/modelos/{modelo}/anos */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ tipo: string; marca: string; modelo: string }> },
) {
  const { tipo, marca, modelo } = await params;
  return respond(() => parallelum.years(vehicleType(tipo), marca, modelo));
}
