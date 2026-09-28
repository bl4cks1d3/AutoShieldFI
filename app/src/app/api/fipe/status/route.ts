import { plateLookupConfigured } from "@/lib/fipe/server/placa";
import { respond } from "@/lib/fipe/server/respond";

/** GET /api/fipe/status -> recursos de consulta disponiveis neste servidor */
export async function GET() {
  return respond(async () => ({ modelo: true, placa: plateLookupConfigured() }), "no-store");
}
