import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/codigo/{codigoFipe}/anos/{ano} -> FipeQuote */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ tipo: string; codigo: string; ano: string }> },
) {
  const { tipo, codigo, ano } = await params;
  return respond(() => parallelum.priceByCode(vehicleType(tipo), codigo, ano));
}
