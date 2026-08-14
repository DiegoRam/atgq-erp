import "server-only";
import { NextResponse } from "next/server";

/**
 * Envelope de respuesta de la API móvil.
 *
 * Los ~48 `actions.ts` del ERP hacen `throw new Error(error.message)`, que
 * propaga el mensaje crudo de Postgres/PostgREST al cliente. Acá no: la API es
 * pública en internet y esos mensajes filtran nombres de tablas, columnas y
 * constraints. Todo sale por `jsonError`, con un código estable para la app y
 * un mensaje en español para el usuario.
 */

export type ApiMeta = {
  page: number;
  per_page: number;
  total: number;
};

/** Cabeceras comunes a toda respuesta de la API. */
export const API_HEADERS: Record<string, string> = {
  // Ni las respuestas ni el token deben quedar en la CDN de Vercel ni en
  // ningún proxy intermedio: todo lo que devuelve esta API es privado del socio.
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function withHeaders(res: NextResponse, requestId: string): NextResponse {
  for (const [k, v] of Object.entries(API_HEADERS)) res.headers.set(k, v);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

/** Identificador de correlación: el socio lo ve, y aparece en los logs de Vercel. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

export function jsonOk<T>(
  data: T,
  requestId: string,
  meta?: ApiMeta,
  status = 200,
): NextResponse {
  return withHeaders(
    NextResponse.json(meta ? { data, meta } : { data }, { status }),
    requestId,
  );
}

export function jsonError(
  code: string,
  status: number,
  message: string,
  requestId: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return withHeaders(
    NextResponse.json(
      { error: { code, message, ...extra }, request_id: requestId },
      { status },
    ),
    requestId,
  );
}
