import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError, newRequestId } from "@/lib/api/response";
import { chequearLimite } from "@/lib/api/rate-limit";
import { validarInvitacionSchema } from "@/lib/schemas/mobile";
import { hashCodigo, tieneFormaDeCodigo } from "@/lib/invitaciones";

/**
 * Paso 1 de la activación: "¿este código es válido, y de quién es?".
 *
 * No consume el código. Sirve para que la app pueda mostrar
 * "¿Sos JUAN PÉREZ, socio 1234?" antes de pedirle email y contraseña, y para
 * que un código vencido se detecte sin haber cargado nada.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const admin = createAdminClient();

  // El body se parsea antes del rate limit porque el limiter necesita el hash
  // del código como clave alternativa cuando no hay una IP confiable (ver
  // chequearLimite). Parsear JSON no toca la base y un body malformado no
  // acerca a nadie a adivinar un código, así que no contarlo no debilita nada.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("body_invalido", 400, "El cuerpo no es JSON válido.", requestId);
  }

  const parsed = validarInvitacionSchema.safeParse(body);
  if (!parsed.success || !tieneFormaDeCodigo(parsed.data.codigo)) {
    return jsonError("codigo_invalido", 400, "El código no es válido.", requestId);
  }

  const codigoHash = hashCodigo(parsed.data.codigo);

  const limite = await chequearLimite(admin, request, requestId, codigoHash);
  if (!limite.permitido) return limite.response;

  const { data, error } = await admin.rpc("mobile_validar_invitacion", {
    p_codigo_hash: codigoHash,
  });
  if (error) {
    console.error(`[${requestId}] mobile_validar_invitacion:`, error);
    return jsonError(
      "error_interno",
      500,
      "Ocurrió un error inesperado. Intente nuevamente más tarde.",
      requestId,
    );
  }

  const fila = Array.isArray(data) ? data[0] : data;
  const estado: string = fila?.estado ?? "inexistente";

  // El detalle sólo se da cuando el hash matcheó una fila real, o sea cuando
  // quien llama YA demostró conocer un código emitido. Para un hash que no
  // existe la respuesta es genérica: así el endpoint no es un oráculo que
  // permita distinguir "no existe" de "existe pero venció".
  switch (estado) {
    case "valida":
      return jsonOk(
        {
          socio: {
            nro_socio: fila.nro_socio,
            apellido: fila.apellido,
            nombre: fila.nombre,
          },
        },
        requestId,
      );
    case "expirada":
      return jsonError(
        "codigo_expirado",
        410,
        "El código venció. Solicite uno nuevo en el club.",
        requestId,
      );
    case "usada":
      return jsonError(
        "codigo_ya_utilizado",
        409,
        "El código ya fue utilizado.",
        requestId,
      );
    case "revocada":
    default:
      return jsonError("codigo_invalido", 400, "El código no es válido.", requestId);
  }
}
