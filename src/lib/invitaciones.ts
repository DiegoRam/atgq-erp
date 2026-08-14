import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Códigos de invitación de la app móvil: generación, normalización y hash.
 *
 * Es el único lugar del sistema donde un código existe en claro. La base
 * guarda sólo sha256(codigo_normalizado || PEPPER); ver el comentario de
 * `socios_invitaciones` en la migración 20260813000001.
 */

/**
 * Alfabeto Crockford base32: sin I, L, O ni U.
 *
 * Sin I/L/O porque se confunden con 1 y 0 cuando alguien tipea un código
 * leído de un papel. Sin U porque su ausencia evita que el generador produzca
 * palabras ofensivas por casualidad — con ~8.400 códigos emitidos, eso pasa.
 */
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LONGITUD = 10;

/**
 * Genera un código nuevo.
 *
 * `byte & 31` no introduce sesgo de módulo porque 32 divide exacto a 256:
 * cada carácter del alfabeto tiene exactamente 8 de los 256 valores posibles
 * de un byte. Por eso no hace falta rejection sampling.
 *
 * Espacio: 32^10 = 2^50 ≈ 1,1×10^15.
 */
export function generarCodigo(): string {
  const bytes = randomBytes(LONGITUD);
  let out = "";
  for (let i = 0; i < LONGITUD; i++) out += ALFABETO[bytes[i] & 31];
  return out;
}

/** Presentación para el mostrador y el Excel: `XXXXX-XXXXX`. El guión es cosmético. */
export function formatearCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

/**
 * Normaliza lo que tipeó el socio antes de hashear.
 *
 * Aplica el mapeo estándar de Crockford (O→0, I→1, L→1) además de mayúsculas y
 * limpieza de separadores: alguien que lee "K7M2P-QX9RT" de un papel y escribe
 * una `l` minúscula en vez de un `1` entra igual. Sin esto, el error de
 * tipeo más común del alfabeto se convierte en "código inválido".
 */
export function normalizarCodigo(entrada: string): string {
  return entrada
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** ¿Tiene la forma de un código? Se chequea antes de gastar un intento del rate limit. */
export function tieneFormaDeCodigo(entrada: string): boolean {
  const c = normalizarCodigo(entrada);
  if (c.length !== LONGITUD) return false;
  for (const ch of c) if (!ALFABETO.includes(ch)) return false;
  return true;
}

function pepper(): string {
  const p = process.env.INVITACIONES_PEPPER;
  if (!p || p.length < 32) {
    // Falla ruidosamente: sin pepper, los hashes de la base quedarían
    // vulnerables a fuerza bruta offline, y peor, serían incompatibles con los
    // emitidos antes. Es preferible un 500 que una emisión silenciosamente insegura.
    throw new Error(
      "INVITACIONES_PEPPER no está configurada (se requieren al menos 32 caracteres)",
    );
  }
  return p;
}

/**
 * Hash de un código, en el formato hex que espera un parámetro `bytea` de una
 * RPC vía PostgREST (`\x...`).
 *
 * No es bcrypt/argon2 a propósito: el código no es una clave elegida por una
 * persona sino un token de un CSPRNG con 2^50 de espacio, así que un KDF lento
 * sólo agregaría latencia al canje legítimo sin cambiar la economía del ataque.
 * El pepper —que vive en el entorno, nunca en la base— es lo que hace inútil
 * un dump de Postgres.
 */
export function hashCodigo(codigo: string): string {
  const normalizado = normalizarCodigo(codigo);
  const h = createHash("sha256")
    .update(normalizado + pepper(), "utf8")
    .digest("hex");
  return `\\x${h}`;
}

/** Los primeros 4 caracteres, que se guardan en claro para identificar el código emitido. */
export function prefijoCodigo(codigo: string): string {
  return normalizarCodigo(codigo).slice(0, 4);
}

/**
 * Hash de la clave del rate limiter.
 *
 * Se usa el mismo pepper: `canje_rate_limit` es un contador, no un registro de
 * quién intentó qué, y no hay razón para guardar IPs de socios en claro.
 */
export function hashClaveLimite(clave: string): string {
  const h = createHash("sha256")
    .update(`rl:${clave}:${pepper()}`, "utf8")
    .digest("hex");
  return `\\x${h}`;
}

/**
 * IP del cliente, sólo si viene de una cabecera que el cliente NO puede setear.
 *
 * `x-vercel-forwarded-for` lo escribe la edge de Vercel y no es falsificable
 * desde afuera. NO se usa `x-forwarded-for` a secas: el cliente le puede
 * anteponer entradas y mandar una IP distinta en cada request, con lo cual el
 * limiter se vuelve un no-op. `x-real-ip` se acepta como segunda opción para
 * despliegues detrás de un reverse proxy propio que la sobrescriba.
 *
 * Devuelve null cuando no hay ninguna cabecera confiable — típicamente
 * corriendo local. Ver `chequearLimite` para qué se hace en ese caso.
 */
export function ipConfiable(request: Request): string | null {
  return (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    null
  );
}
