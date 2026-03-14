"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Caja, CajaFormData } from "@/types/tesoreria";

export async function getCajas(): Promise<Caja[]> {
  const supabase = createClient();

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
  const supabase = createClient();
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
  const supabase = createClient();
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
