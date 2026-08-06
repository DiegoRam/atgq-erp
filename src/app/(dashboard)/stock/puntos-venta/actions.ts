"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deleteUbicacion } from "../ubicaciones";
import type { Deposito, DepositoFormData } from "@/types/stock";

/**
 * Los puntos de venta son filas de `depositos` con tipo = 'punto_venta',
 * así el inventario y los movimientos de stock sirven para ambos sin
 * duplicar tablas ni FKs.
 */
export async function getPuntosVenta(): Promise<Deposito[]> {
  const supabase = await createClient();

  const { data: puntos, error } = await supabase
    .from("depositos")
    .select("*, caja:cajas(id, nombre)")
    .eq("tipo", "punto_venta")
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!puntos || puntos.length === 0) return [];

  // Ítems con existencia > 0 por punto de venta
  const puntoIds = puntos.map((p) => p.id);
  const { data: inventario } = await supabase
    .from("stock_inventario")
    .select("deposito_id, cantidad")
    .in("deposito_id", puntoIds);

  const itemCounts: Record<string, number> = {};
  if (inventario) {
    for (const row of inventario) {
      if (row.cantidad > 0) {
        itemCounts[row.deposito_id] = (itemCounts[row.deposito_id] ?? 0) + 1;
      }
    }
  }

  return puntos.map((p) => ({
    ...p,
    item_count: itemCounts[p.id] ?? 0,
  })) as Deposito[];
}

export async function getCajasForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("id, nombre")
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPuntoVenta(formData: DepositoFormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("depositos").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    activo: formData.activo,
    tipo: "punto_venta",
    caja_id: formData.caja_id || null,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una ubicación con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/stock/puntos-venta");
  revalidatePath("/ventas/nueva");
}

export async function updatePuntoVenta(id: string, formData: DepositoFormData) {
  const supabase = await createClient();

  // No se puede desactivar un punto de venta con existencias
  if (!formData.activo) {
    const { data: withStock } = await supabase
      .from("stock_inventario")
      .select("id")
      .eq("deposito_id", id)
      .gt("cantidad", 0)
      .limit(1);

    if (withStock && withStock.length > 0) {
      throw new Error(
        "No se puede desactivar un punto de venta con ítems en stock",
      );
    }
  }

  const { error } = await supabase
    .from("depositos")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      activo: formData.activo,
      caja_id: formData.caja_id || null,
    })
    .eq("id", id)
    .eq("tipo", "punto_venta");

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una ubicación con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/stock/puntos-venta");
  revalidatePath("/ventas/nueva");
}

export async function deletePuntoVenta(id: string) {
  const supabase = await createClient();
  await deleteUbicacion(supabase, id, "punto_venta");
  revalidatePath("/stock/puntos-venta");
  revalidatePath("/ventas/nueva");
}
