import "server-only";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashClaveLimite, ipConfiable } from "@/lib/invitaciones";
import { jsonError } from "./response";

/**
 * Freno de fuerza bruta sobre los códigos de invitación.
 *
 * El contador vive en la tabla `canje_rate_limit` y no en memoria porque
 * Vercel corre lambdas sin estado compartido: un Map de módulo arrancaría
 * vacío en cada invocación y el límite sería decorativo.
 *
 * `registrar_intento_canje` está revocada de `anon` y de `authenticated`, así
 * que sólo se puede llegar a ella con service_role — o sea, sólo desde acá.
 * Eso es lo que impide saltear el limiter llamando la RPC de canje directo.
 */
export type ResultadoLimite =
  | { permitido: true; claveHash: string }
  | { permitido: false; response: NextResponse };

/**
 * @param discriminante clave alternativa cuando no hay una IP confiable
 *        (se usa el hash del código intentado).
 *
 * Sobre el caso sin IP confiable: la tentación es meter todos esos requests en
 * un bucket fijo ("desconocida"), pero eso hace que 11 intentos de cualquiera
 * bloqueen las activaciones de TODOS los socios durante una hora — un DoS
 * trivial contra la funcionalidad entera. Se usa entonces una clave derivada
 * del código intentado.
 *
 * SIN VUELTAS: en ese modo NO hay protección contra fuerza bruta. Un atacante
 * que prueba un código distinto por request cae en un bucket distinto cada vez
 * y nunca se bloquea. Lo único que frena es machacar un mismo código. Se elige
 * porque la alternativa (bucket global) es un DoS seguro contra todos los
 * socios, mientras que esto sólo pierde protección en un despliegue mal
 * configurado. En Vercel —el despliegue real— la cabecera siempre está, así
 * que este camino es el de desarrollo local; si alguna vez se despliega fuera
 * de Vercel, hay que poner un proxy que setee la IP antes de exponer la API.
 */
export async function chequearLimite(
  admin: SupabaseClient,
  request: Request,
  requestId: string,
  discriminante: string,
): Promise<ResultadoLimite> {
  const ip = ipConfiable(request);
  if (!ip) {
    console.warn(
      `[${requestId}] sin cabecera de IP confiable: el rate limit de invitaciones degrada a por-código`,
    );
  }
  const claveHash = hashClaveLimite(ip ? `ip:${ip}` : `cod:${discriminante}`);

  const { data, error } = await admin.rpc("registrar_intento_canje", {
    p_ip_hash: claveHash,
  });

  if (error) {
    // Falla cerrado: si no se puede contar el intento, no se procesa el
    // intento. Lo contrario convertiría una caída de la base en una ventana
    // sin límite justo cuando menos se puede verificar qué está pasando.
    console.error(`[${requestId}] registrar_intento_canje:`, error);
    return {
      permitido: false,
      response: jsonError(
        "error_interno",
        500,
        "Ocurrió un error inesperado. Intente nuevamente más tarde.",
        requestId,
      ),
    };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (fila?.bloqueado) {
    const retryAfter = Number(fila.retry_after ?? 3600);
    const res = jsonError(
      "demasiados_intentos",
      429,
      "Demasiados intentos. Espere unos minutos e intente nuevamente.",
      requestId,
      { retry_after: retryAfter },
    );
    res.headers.set("Retry-After", String(retryAfter));
    return { permitido: false, response: res };
  }

  return { permitido: true, claveHash };
}

/** Se llama tras un canje exitoso: quien tenía un código válido no es un atacante. */
export async function limpiarLimite(
  admin: SupabaseClient,
  claveHash: string,
): Promise<void> {
  await admin.rpc("limpiar_intento_canje", { p_ip_hash: claveHash });
}
