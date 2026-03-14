"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { StockItem, StockItemFormData } from "@/types/stock";

export async function getStockItems(): Promise<StockItem[]> {
  const supabase = createClient();

  const { data: items, error } = await supabase
    .from("stock_items")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  // Get SUM(cantidad) per item from stock_inventario
  const itemIds = items.map((i) => i.id);
  const { data: inventario } = await supabase
    .from("stock_inventario")
    .select("item_id, cantidad")
    .in("item_id", itemIds);

  const totals: Record<string, number> = {};
  if (inventario) {
    for (const row of inventario) {
      totals[row.item_id] = (totals[row.item_id] ?? 0) + row.cantidad;
    }
  }

  return items.map((i) => ({
    ...i,
    stock_total: totals[i.id] ?? 0,
  })) as StockItem[];
}

export async function createStockItem(formData: StockItemFormData) {
  const supabase = createClient();

  const { data: item, error } = await supabase
    .from("stock_items")
    .insert({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      unidad: formData.unidad,
      activo: formData.activo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem con ese nombre");
    }
    throw new Error(error.message);
  }

  // If stock_inicial > 0, create inventory + movement
  if (formData.stock_inicial && formData.stock_inicial > 0) {
    const { data: deposito } = await supabase
      .from("depositos")
      .select("id")
      .eq("nombre", "Deposito Central")
      .single();

    if (deposito) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("stock_inventario").upsert(
        {
          item_id: item.id,
          deposito_id: deposito.id,
          cantidad: formData.stock_inicial,
        },
        { onConflict: "item_id,deposito_id" },
      );

      if (user) {
        await supabase.from("movimientos_stock").insert({
          item_id: item.id,
          deposito_id: deposito.id,
          tipo: "ingreso",
          cantidad: formData.stock_inicial,
          motivo: "Stock inicial",
          usuario_id: user.id,
        });
      }
    }
  }

  revalidatePath("/stock/items");
  revalidatePath("/stock");
}

export async function updateStockItem(
  id: string,
  formData: Omit<StockItemFormData, "stock_inicial">,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("stock_items")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      unidad: formData.unidad,
      activo: formData.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/stock/items");
}
