"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Deposito, DepositoFormData } from "@/types/stock";

export async function getDepositos(): Promise<Deposito[]> {
  const supabase = createClient();

  const { data: depositos, error } = await supabase
    .from("depositos")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!depositos || depositos.length === 0) return [];

  // Count items with qty > 0 per deposito
  const depositoIds = depositos.map((d) => d.id);
  const { data: inventario } = await supabase
    .from("stock_inventario")
    .select("deposito_id, cantidad")
    .in("deposito_id", depositoIds);

  const itemCounts: Record<string, number> = {};
  if (inventario) {
    for (const row of inventario) {
      if (row.cantidad > 0) {
        itemCounts[row.deposito_id] = (itemCounts[row.deposito_id] ?? 0) + 1;
      }
    }
  }

  return depositos.map((d) => ({
    ...d,
    item_count: itemCounts[d.id] ?? 0,
  })) as Deposito[];
}

export async function createDeposito(formData: DepositoFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("depositos").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    activo: formData.activo,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un depósito con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/stock/depositos");
}

export async function updateDeposito(id: string, formData: DepositoFormData) {
  const supabase = createClient();

  // If deactivating, check no stock
  if (!formData.activo) {
    const { data: withStock } = await supabase
      .from("stock_inventario")
      .select("id")
      .eq("deposito_id", id)
      .gt("cantidad", 0)
      .limit(1);

    if (withStock && withStock.length > 0) {
      throw new Error(
        "No se puede desactivar un depósito con ítems en stock",
      );
    }
  }

  const { error } = await supabase
    .from("depositos")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      activo: formData.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un depósito con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/stock/depositos");
}
