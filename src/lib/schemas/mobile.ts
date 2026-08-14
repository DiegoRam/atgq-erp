import { z } from "zod";

/**
 * Validación de entrada de la API móvil.
 *
 * Es el primer schema de input de query/paginación del repo: el ERP parsea
 * `searchParams` a mano en cada página. Acá no alcanza con eso, porque estos
 * valores vienen de internet y no de un formulario propio.
 *
 * Nota: el clamp de `per_page` está TAMBIÉN en las funciones SQL
 * (`least(greatest(...))`). No es redundancia por las dudas: las RPCs son
 * alcanzables por PostgREST directo con el JWT del socio, sin pasar por estos
 * handlers, así que el límite tiene que existir en los dos lados.
 */

const pagina = z.coerce.number().int().min(1).default(1);
const porPagina = z.coerce.number().int().min(1).max(100).default(50);

export const paginacionSchema = z.object({
  page: pagina,
  per_page: porPagina,
});

export const cuotasQuerySchema = z.object({
  estado: z.enum(["todas", "impagas", "pagas"]).default("todas"),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  page: pagina,
  per_page: porPagina,
});

export type CuotasQuery = z.infer<typeof cuotasQuerySchema>;

export const comprasQuerySchema = z.object({
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  page: pagina,
  per_page: porPagina,
});

export type ComprasQuery = z.infer<typeof comprasQuerySchema>;

/** El código se normaliza en `normalizarCodigo` antes de hashear; acá sólo se acota el largo. */
export const validarInvitacionSchema = z.object({
  codigo: z.string().trim().min(1, "Ingrese el código").max(40, "Código inválido"),
});

export const canjearInvitacionSchema = z.object({
  codigo: z.string().trim().min(1, "Ingrese el código").max(40, "Código inválido"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  // 8 caracteres es el mínimo que ya usa el ABM de usuarios del ERP
  // (usuarioCreateSchema en src/lib/schemas/security.ts); se mantiene igual
  // para no tener dos políticas de contraseña distintas en el mismo proyecto.
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

export type CanjearInvitacion = z.infer<typeof canjearInvitacionSchema>;

/**
 * Convierte los searchParams de una URL en un objeto plano para el schema.
 * Los valores ausentes se omiten para que los `.default()` de Zod apliquen.
 */
export function queryParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URL(url).searchParams;
  for (const [k, v] of sp.entries()) if (v !== "") out[k] = v;
  return out;
}
