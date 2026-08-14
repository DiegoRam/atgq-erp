import "server-only";
import { NextResponse } from "next/server";
import { jsonError } from "./response";

/**
 * Traducción de los errores que levantan las RPCs de la app móvil a
 * (status HTTP, mensaje en español).
 *
 * IMPORTANTE — contrato: las funciones de la migración
 * `20260813000001_app_movil_socios.sql` hacen `RAISE EXCEPTION 'no_es_titular'`
 * y no `RAISE EXCEPTION 'Sólo el titular puede...'`. Esos identificadores
 * snake_case son **contrato de API, no mensajes para humanos**. El instinto de
 * quien lea la migración va a ser "mejorarlos" a una frase en español; hacerlo
 * rompe este mapeo en silencio y todos los errores pasan a ser 500 genéricos.
 * Si hay que cambiar un identificador, hay que cambiarlo en los dos lados.
 */
const MAPA: Record<string, [number, string]> = {
  // Identidad / autorización
  cuenta_no_vinculada: [
    403,
    "Su cuenta no está vinculada a ningún socio. Contacte al club.",
  ],
  sin_grupo_familiar: [403, "No pertenece a un grupo familiar."],
  grupo_sin_titular: [
    403,
    "El grupo familiar no tiene titular designado. Contacte al club.",
  ],
  no_es_titular: [
    403,
    "Sólo el titular del grupo familiar puede ver esta información.",
  ],
  sin_permiso: [403, "No tiene permisos para realizar esta operación."],
  no_autenticado: [401, "No autenticado."],

  // Invitaciones
  codigo_invalido: [400, "El código no es válido."],
  socio_ya_vinculado: [409, "El socio ya tiene una cuenta activa."],
  socio_inexistente: [404, "El socio no existe."],
  sin_cuenta_vinculada: [404, "El socio no tiene una cuenta vinculada."],
  dias_fuera_de_rango: [400, "La validez debe estar entre 1 y 90 días."],
  lote_demasiado_grande: [400, "El lote no puede superar los 1.000 socios."],

  // Invariante socio ≠ staff (triggers de la migración)
  cuenta_con_rol_erp: [
    409,
    "La cuenta tiene un rol del ERP asignado; no puede vincularse como socio.",
  ],
  cuenta_vinculada_a_socio: [
    409,
    "La cuenta está vinculada a un socio de la app; no puede recibir un rol del ERP.",
  ],
};

/** ¿Este error de Postgres corresponde a un código conocido del contrato? */
export function codigoDeError(message: string | undefined): string | null {
  if (!message) return null;
  const limpio = message.trim();
  return limpio in MAPA ? limpio : null;
}

/**
 * Convierte un error de una RPC en una NextResponse.
 *
 * Lo no mapeado es un 500 genérico: el detalle real va a `console.error` junto
 * al requestId, para poder correlacionarlo en los logs de Vercel sin
 * mostrárselo a nadie.
 */
export function responseDeErrorRpc(
  error: { message?: string } | null,
  requestId: string,
  contexto: string,
): NextResponse {
  const codigo = codigoDeError(error?.message);
  if (codigo) {
    const [status, mensaje] = MAPA[codigo];
    return jsonError(codigo, status, mensaje, requestId);
  }
  console.error(`[${requestId}] ${contexto}:`, error);
  return jsonError(
    "error_interno",
    500,
    "Ocurrió un error inesperado. Intente nuevamente más tarde.",
    requestId,
  );
}
