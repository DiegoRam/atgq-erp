import { requireSocio } from "@/lib/api/mobile-auth";
import { jsonOk } from "@/lib/api/response";
import { responseDeErrorRpc } from "@/lib/api/rpc-errors";

export async function GET(request: Request) {
  const auth = await requireSocio(request);
  if (!auth.ok) return auth.response;
  const { supabase, requestId } = auth.ctx;

  const { data, error } = await supabase.rpc("mobile_mi_resumen_cuotas");
  if (error)
    return responseDeErrorRpc(error, requestId, "mobile_mi_resumen_cuotas");

  const fila = Array.isArray(data) ? data[0] : data;
  // Un socio sin ninguna cuota cargada no es un error: el resumen es cero.
  return jsonOk(
    fila ?? {
      cuotas_impagas: 0,
      monto_adeudado: 0,
      cuotas_pagadas: 0,
      ultimo_periodo_pagado: null,
      primer_periodo_impago: null,
    },
    requestId,
  );
}
