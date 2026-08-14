import "server-only";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBearerClient } from "@/lib/supabase/bearer";
import { jsonError, newRequestId } from "./response";

/**
 * Autenticación de los route handlers de la app móvil.
 *
 * Es el ÚNICO lugar donde se resuelve auth.uid() → socio_id. Ningún handler
 * construye su propio cliente Supabase ni acepta un socio_id por parámetro:
 * reciben el contexto ya resuelto y el cliente ya atado al token del socio.
 * Esa es la razón de que devuelva `supabase` adentro del contexto — hace
 * estructuralmente incómodo terminar usando el admin client por accidente.
 */

export type SocioContext = {
  userId: string;
  socioId: string;
  nroSocio: number;
  supabase: SupabaseClient;
  requestId: string;
};

export type AuthResult =
  | { ok: true; ctx: SocioContext }
  | { ok: false; response: NextResponse };

function tokenDelHeader(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [esquema, token] = header.split(" ");
  if (!token || esquema.toLowerCase() !== "bearer") return null;
  const limpio = token.trim();
  return limpio.length > 0 ? limpio : null;
}

function noAutenticado(requestId: string, mensaje: string): NextResponse {
  const res = jsonError("no_autenticado", 401, mensaje, requestId);
  res.headers.set("WWW-Authenticate", "Bearer");
  return res;
}

/**
 * Resuelve el socio del request, o devuelve la respuesta de error ya armada.
 *
 * Uso en cada handler:
 *   const auth = await requireSocio(request);
 *   if (!auth.ok) return auth.response;
 *   const { supabase, socioId, requestId } = auth.ctx;
 *
 * Falla cerrado en todos los caminos: sin header → 401; token inválido o
 * vencido → 401; token válido sin vínculo → 403; vínculo revocado → 403.
 */
export async function requireSocio(request: Request): Promise<AuthResult> {
  const requestId = newRequestId();

  const token = tokenDelHeader(request);
  if (!token) {
    return {
      ok: false,
      response: noAutenticado(requestId, "Falta el token de autenticación."),
    };
  }

  const supabase = createBearerClient(token);

  // Una sola ida y vuelta que resuelve la identidad Y valida el token.
  // No se llama a auth.getUser() a propósito: PostgREST verifica la firma del
  // JWT con el secreto del proyecto ANTES de poblar auth.uid(), así que un
  // token manipulado o vencido falla acá mismo. Llamar además a GoTrue sería
  // un round-trip extra por request que no agrega ninguna garantía.
  const { data, error } = await supabase.rpc("mobile_contexto_socio");

  if (error) {
    // Un token vencido o manipulado tiene que dar 401, no 500. PostgREST lo
    // reporta como PGRST301 ("JWT expired") y familia, pero un token que ni
    // siquiera parsea puede ser rechazado antes, con otra forma de error; por
    // eso se mira también el mensaje y el status. Sin este segundo camino, un
    // token basura terminaba en "error interno" y la app no sabía que le
    // bastaba con renovar la sesión.
    const code = (error as { code?: string }).code ?? "";
    const status = (error as { status?: number }).status;
    const msg = (error.message ?? "").toLowerCase();
    const esProblemaDeToken =
      code.startsWith("PGRST3") ||
      code === "42501" ||
      status === 401 ||
      msg.includes("jwt") ||
      msg.includes("token");
    if (esProblemaDeToken) {
      return {
        ok: false,
        response: noAutenticado(requestId, "El token no es válido o expiró."),
      };
    }
    console.error(`[${requestId}] mobile_contexto_socio:`, error);
    return {
      ok: false,
      response: jsonError(
        "error_interno",
        500,
        "Ocurrió un error inesperado. Intente nuevamente más tarde.",
        requestId,
      ),
    };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila?.socio_id) {
    return {
      ok: false,
      response: jsonError(
        "cuenta_no_vinculada",
        403,
        "Su cuenta no está vinculada a ningún socio. Contacte al club.",
        requestId,
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      userId: fila.user_id as string,
      socioId: fila.socio_id as string,
      nroSocio: fila.nro_socio as number,
      supabase,
      requestId,
    },
  };
}
