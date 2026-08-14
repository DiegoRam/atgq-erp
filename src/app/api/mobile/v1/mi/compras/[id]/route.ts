import { z } from "zod";
import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk, jsonError } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    // Un id con forma inválida se rechaza como "no encontrado" y no como
    // "parámetro inválido": la respuesta es la misma que para un uuid ajeno,
    // así que no hay forma de distinguir los dos casos desde afuera.
    return jsonError("no_encontrado", 404, "La compra no existe.", requestId);
  }

  const { data, error } = await supabase.rpc("mobile_mi_compra_detalle", {
    p_venta_id: id,
  });
  if (error)
    return responseDeErrorRpc(error, requestId, "mobile_mi_compra_detalle");

  // La RPC devuelve NULL tanto si la venta no existe como si es de otro socio.
  // Se responde 404 en ambos casos, nunca 403: un 403 confirmaría que el uuid
  // existe y pertenece a otra persona.
  if (!data) {
    return jsonError("no_encontrado", 404, "La compra no existe.", requestId);
  }

  return jsonOk(data, requestId);
}
