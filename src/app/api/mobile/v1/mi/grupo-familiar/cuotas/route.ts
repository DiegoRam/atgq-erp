import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk, jsonError } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";
import { listarPaginado } from "@/lib/api/paginacion";
import { cuotasQuerySchema, queryParams } from "@/lib/schemas/mobile";

export async function GET(request: Request) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const parsed = cuotasQuerySchema.safeParse(queryParams(request.url));
  if (!parsed.success) {
    return jsonError(
      "parametros_invalidos",
      400,
      parsed.error.issues[0].message,
      requestId,
    );
  }
  const { estado, desde, hasta, page, per_page } = parsed.data;

  // La RPC vuelve a chequear que el socio sea el titular del grupo; no confía
  // en que el handler ya lo haya validado al pedir el listado de miembros.
  const res = await listarPaginado(
    (limit, offset) =>
      supabase.rpc("mobile_mi_grupo_familiar_cuotas", {
        p_estado: estado,
        p_desde: desde ?? null,
        p_hasta: hasta ?? null,
        p_limit: limit,
        p_offset: offset,
      }),
    page,
    per_page,
  );
  if (!res.ok)
    return responseDeErrorRpc(
      res.error,
      requestId,
      "mobile_mi_grupo_familiar_cuotas",
    );

  return jsonOk(res.data, requestId, res.meta);
}
