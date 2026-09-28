import { FipeError } from "@/lib/fipe/server/parallelum";
import { lookupPlate } from "@/lib/fipe/server/placa";
import { respond } from "@/lib/fipe/server/respond";
import { normalizePlate, PLATE_RE } from "@/lib/fipe/types";

/** GET /api/placa/{placa} -> PlateLookup (veiculo + versoes FIPE compativeis) */
export async function GET(_: Request, { params }: { params: Promise<{ placa: string }> }) {
  const placa = normalizePlate((await params).placa);
  return respond(async () => {
    if (!PLATE_RE.test(placa)) throw new FipeError("Placa inválida (ex.: ABC1D23 ou ABC1234)", 400);
    return lookupPlate(placa);
  }, "private, no-store");
}
