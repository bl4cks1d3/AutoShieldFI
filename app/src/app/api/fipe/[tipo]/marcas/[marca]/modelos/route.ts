import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/marcas/{marca}/modelos */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string; marca: string }> }) {
  const { tipo, marca } = await params;
  return respond(() => parallelum.models(vehicleType(tipo), marca));
}
