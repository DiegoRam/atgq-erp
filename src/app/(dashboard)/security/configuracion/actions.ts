"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { Configuracion, RecalculoResultado } from "@/types/configuracion";

/**
 * Mismo helper que `security/roles/actions.ts:10-20`.
 *
 * A diferencia del resto del módulo, acá **no** se usa `createAdminClient()`:
 * el RPC de recálculo es SECURITY DEFINER y chequea permisos con
 * `get_user_modulo_permission()`, que se apoya en `auth.uid()`. Con la clave
 * de servicio `auth.uid()` es NULL y el RPC rebotaría con "No autenticado".
 * Las políticas RLS de `configuracion` están escritas justamente para que el
 * cliente cookie-bound alcance.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) throw new Error("No autorizado — requiere rol Administrador");
  return user;
}

/**
 * Devuelve el error en vez de tirarlo, igual que el resto de este archivo.
 *
 * No es cosmético: cuando esta pantalla salió a producción antes de que se
 * aplicara la migración `20260812000003`, la tabla no existía y el usuario vio
 * el texto genérico de Next ("An error occurred in the Server Components
 * render… omitted in production builds") en vez de "relation configuracion does
 * not exist". El motivo real —una migración pendiente— quedó invisible
 * justamente en el entorno donde no se puede abrir una consola.
 */
export async function getConfiguracion(): Promise<{
  data?: Configuracion;
  error?: string;
}> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("configuracion")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("getConfiguracion", error);
      return { error: error.message };
    }
    return {
      data: { ...data, recargo_no_socio_pct: Number(data.recargo_no_socio_pct) },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Error al cargar la configuración",
    };
  }
}

/**
 * El error se **devuelve**, no se tira: en un build de producción Next redacta
 * el mensaje de cualquier Error que escape de un server action. Misma
 * convención que `deleteItemVenta` y `login/actions.ts`.
 */
export async function updateConfiguracion(data: {
  recargo_no_socio_pct: number;
}): Promise<{ error?: string }> {
  try {
    const user = await requireAdmin();
    const supabase = await createClient();

    // Los dos decimales de NUMERIC(5,2), redondeados acá y no por la base:
    // así lo que se guarda es lo que el usuario vuelve a leer.
    const pct = Math.round(data.recargo_no_socio_pct * 100) / 100;
    if (!Number.isFinite(pct) || pct < 0 || pct > 200) {
      return { error: "El recargo debe estar entre 0 y 200%" };
    }

    const { data: rows, error } = await supabase
      .from("configuracion")
      .update({ recargo_no_socio_pct: pct, updated_by: user.id })
      .eq("id", 1)
      .select("id");

    if (error) {
      console.error("updateConfiguracion", error);
      return { error: error.message };
    }
    // RLS que deniega no devuelve error: devuelve cero filas.
    if (!rows || rows.length === 0) {
      return { error: "No se pudo guardar: no tiene permisos para modificar la configuración." };
    }

    revalidatePath("/security/configuracion");
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Error al guardar la configuración",
    };
  }
}

/**
 * `RETURNS TABLE` llega como array de una fila. Los NUMERIC pueden venir como
 * string según la precisión, así que se coercen — el repo ya hace lo mismo con
 * `Number(item.precio)`.
 */
function parseResultado(row: Record<string, unknown>): RecalculoResultado {
  const muestra = Array.isArray(row.muestra) ? row.muestra : [];
  return {
    pct: Number(row.pct),
    total: Number(row.total),
    afectados: Number(row.afectados),
    a_cero: Number(row.a_cero),
    con_nombre_socio: Number(row.con_nombre_socio),
    muestra: muestra.map((m: Record<string, unknown>) => ({
      nombre: String(m.nombre),
      precio: Number(m.precio),
      actual: Number(m.actual),
      nuevo: Number(m.nuevo),
    })),
  };
}

async function correrRecalculo(
  dryRun: boolean,
  pctEsperado?: number,
): Promise<{ data?: RecalculoResultado; error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("recalcular_precios_no_socio", {
      p_dry_run: dryRun,
      p_pct_esperado: pctEsperado ?? null,
    });

    if (error) {
      console.error("recalcular_precios_no_socio", error);
      return { error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "El recálculo no devolvió resultados" };

    return { data: parseResultado(row) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Error al recalcular los precios",
    };
  }
}

/** Calcula y reporta sin escribir nada. */
export async function previewRecalculoNoSocio() {
  return correrRecalculo(true);
}

/**
 * Aplica el recálculo a **todos** los ítems de venta. El porcentaje que se
 * aplica sale siempre de la base dentro del RPC; `pctEsperado` es sólo el
 * testigo de lo que el operador vio en la previsualización, y el RPC aborta si
 * alguien cambió la configuración entre una llamada y la otra.
 */
export async function ejecutarRecalculoNoSocio(pctEsperado: number) {
  const result = await correrRecalculo(false, pctEsperado);
  if (!result.error) {
    revalidatePath("/security/configuracion");
    revalidatePath("/ventas/items");
    revalidatePath("/ventas/nueva");
  }
  return result;
}
