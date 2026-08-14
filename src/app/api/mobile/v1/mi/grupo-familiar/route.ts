import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";

export async function GET(request: Request) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const { data, error } = await supabase.rpc("mobile_mi_grupo_familiar");
  // Los tres caminos de denegación (sin_grupo_familiar, grupo_sin_titular,
  // no_es_titular) llegan como excepciones de la RPC y los mapea
  // responseDeErrorRpc a 403 con su mensaje propio.
  if (error)
    return responseDeErrorRpc(error, requestId, "mobile_mi_grupo_familiar");

  const miembros = data ?? [];
  return jsonOk(
    {
      grupo_id: miembros[0]?.grupo_id ?? null,
      miembros,
    },
    requestId,
  );
}
