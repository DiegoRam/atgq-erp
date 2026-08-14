import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk, jsonError } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";
import { listarPaginado } from "@/lib/api/paginacion";
import { comprasQuerySchema, queryParams } from "@/lib/schemas/mobile";

/**
 * Argentina no tiene horario de verano, así que el offset es fijo. Se escribe
 * explícito porque `ventas.fecha` es timestamptz y la sesión de Postgres corre
 * en UTC: sin offset, un "2026-08-13T23:59:59" se interpreta como UTC y una
 * compra hecha a las 21:30 ART del último día del rango queda afuera del filtro
 * del propio socio.
 */
const OFFSET_ART = "-03:00";

export async function GET(request: Request) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const parsed = comprasQuerySchema.safeParse(queryParams(request.url));
  if (!parsed.success) {
    return jsonError(
      "parametros_invalidos",
      400,
      parsed.error.issues[0].message,
      requestId,
    );
  }
  const { desde, hasta, page, per_page } = parsed.data;

  const res = await listarPaginado(
    (limit, offset) =>
      supabase.rpc("mobile_mis_compras", {
        // Los filtros llegan como fecha (YYYY-MM-DD) y la columna es
        // timestamptz: hay que abarcar el día completo en hora argentina.
        p_desde: desde ? `${desde}T00:00:00${OFFSET_ART}` : null,
        p_hasta: hasta ? `${hasta}T23:59:59.999${OFFSET_ART}` : null,
        p_limit: limit,
        p_offset: offset,
      }),
    page,
    per_page,
  );
  if (!res.ok) return responseDeErrorRpc(res.error, requestId, "mobile_mis_compras");

  return jsonOk(res.data, requestId, res.meta);
}
