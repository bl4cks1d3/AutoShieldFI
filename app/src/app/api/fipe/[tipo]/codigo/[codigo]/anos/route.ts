import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/codigo/{codigoFipe}/anos */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string; codigo: string }> }) {
  const { tipo, codigo } = await params;
  return respond(() => parallelum.yearsByCode(vehicleType(tipo), codigo));
}
