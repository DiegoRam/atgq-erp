"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Caja, CajaFormData } from "@/types/tesoreria";

export async function getCajas(): Promise<Caja[]> {
  const supabase = await createClient();

  const { data: cajas, error } = await supabase
    .from("cajas")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!cajas || cajas.length === 0) return [];

  // Calculate saldo_actual for each caja:
  // saldo_actual = saldo_inicial + SUM(ingresos) - SUM(egresos)
  const cajaIds = cajas.map((c) => c.id);

  const { data: movimientos } = await supabase
    .from("movimientos_fondos")
    .select("caja_id, tipo, monto")
    .in("caja_id", cajaIds);

  const saldos: Record<string, number> = {};
  if (movimientos) {
    for (const mov of movimientos) {
      if (!saldos[mov.caja_id]) saldos[mov.caja_id] = 0;
      if (mov.tipo === "ingreso" || mov.tipo === "transferencia") {
        // For transfers, we check if this caja is the destination
        // (transfers INTO this caja are recorded as tipo='transferencia' with referencia_id)
        // Actually, based on schema: ingreso adds, egreso/transferencia-out subtracts
        saldos[mov.caja_id] += Number(mov.monto);
      } else {
        saldos[mov.caja_id] -= Number(mov.monto);
      }
    }
  }

  return cajas.map((c) => ({
    ...c,
    saldo_actual: Number(c.saldo_inicial) + (saldos[c.id] ?? 0),
  })) as Caja[];
}

export async function createCaja(formData: CajaFormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("cajas").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    saldo_inicial: formData.saldo_inicial,
    activa: formData.activa,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una caja con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/tesoreria/cajas");
}

export async function updateCaja(id: string, formData: CajaFormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cajas")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      saldo_inicial: formData.saldo_inicial,
      activa: formData.activa,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una caja con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/tesoreria/cajas");
}

/**
 * Los conteos se hacen con el cliente del usuario, así que RLS puede ocultar
 * filas de otro módulo (p.ej. un rol con `tesoreria.eliminar` pero sin
 * `stock.leer`) y devolver 0 sin error. Se falla cerrado ante un `count` nulo, y
 * el FK 23503 queda como red final: sólo se pierde el mensaje detallado.
 */
function bloquea(count: number | null): boolean {
  return count === null || count > 0;
}

export async function deleteCaja(id: string) {
  const supabase = await createClient();

  // Todas las FKs entrantes son NO ACTION: se chequean antes para poder dar un
  // mensaje entendible en vez de un 23503 crudo. Dos consultas con `.eq()` en
  // vez de un `.or()` interpolado: supabase-js codifica los valores de `.eq()`,
  // el contenido de `.or()` se parsea crudo.
  const { count: movOrigenCount, error: movOrigenError } = await supabase
    .from("movimientos_fondos")
    .select("*", { count: "exact", head: true })
    .eq("caja_id", id);
  if (movOrigenError) throw new Error(movOrigenError.message);

  const { count: movDestinoCount, error: movDestinoError } = await supabase
    .from("movimientos_fondos")
    .select("*", { count: "exact", head: true })
    .eq("caja_destino_id", id);
  if (movDestinoError) throw new Error(movDestinoError.message);

  if (bloquea(movOrigenCount) || bloquea(movDestinoCount)) {
    throw new Error(
      "No se puede eliminar la caja: tiene movimientos de fondos. Desactívela en su lugar.",
    );
  }

  const { count: pvCount, error: pvError } = await supabase
    .from("depositos")
    .select("*", { count: "exact", head: true })
    .eq("caja_id", id);
  if (pvError) throw new Error(pvError.message);
  if (bloquea(pvCount)) {
    throw new Error(
      "No se puede eliminar la caja: tiene puntos de venta vinculados. Desvincúlelos primero.",
    );
  }

  const { data, error } = await supabase
    .from("cajas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "No se puede eliminar la caja: tiene registros asociados. Desactívela en su lugar.",
      );
    }
    throw new Error(error.message);
  }

  // RLS que deniega no devuelve error: devuelve cero filas.
  if (!data || data.length === 0) {
    throw new Error(
      "No se pudo eliminar la caja: no existe o no tiene permisos para eliminarla.",
    );
  }

  revalidatePath("/tesoreria/cajas");
  revalidatePath("/stock/puntos-venta");
}
