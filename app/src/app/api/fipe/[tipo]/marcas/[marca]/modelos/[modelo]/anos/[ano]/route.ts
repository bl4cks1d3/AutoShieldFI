import { parallelum } from "@/lib/fipe/server/parallelum";
import { respond, vehicleType } from "@/lib/fipe/server/respond";

/** GET /api/fipe/{tipo}/marcas/{marca}/modelos/{modelo}/anos/{ano} -> FipeQuote */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ tipo: string; marca: string; modelo: string; ano: string }> },
) {
  const { tipo, marca, modelo, ano } = await params;
  return respond(() => parallelum.price(vehicleType(tipo), marca, modelo, ano));
}
