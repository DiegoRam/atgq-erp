import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk, jsonError } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";

export async function GET(request: Request) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const { data, error } = await supabase.rpc("mobile_mi_perfil");
  if (error) return responseDeErrorRpc(error, requestId, "mobile_mi_perfil");

  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil) {
    // requireSocio ya garantizó el vínculo, así que llegar acá significa que el
    // socio fue borrado entre una consulta y la otra. Es un 404 honesto.
    return jsonError(
      "socio_inexistente",
      404,
      "No se encontraron los datos del socio.",
      requestId,
    );
  }

  return jsonOk(perfil, requestId);
}
