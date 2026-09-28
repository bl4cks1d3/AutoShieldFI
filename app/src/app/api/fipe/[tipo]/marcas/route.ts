import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/marcas */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  return respond(() => parallelum.brands(vehicleType(tipo)));
}
