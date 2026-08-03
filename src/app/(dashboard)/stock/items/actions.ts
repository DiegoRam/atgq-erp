"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Deposito, StockItem, StockItemFormData } from "@/types/stock";

/** Ubicaciones donde se puede acreditar el stock inicial de un ítem nuevo */
export async function getUbicacionesParaStockInicial(): Promise<Deposito[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("*")
    .eq("activo", true)
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposito[];
}

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

  // Si hay stock inicial, se acredita en la ubicación elegida en el form.
  // Sin ubicación explícita cae al primer depósito activo (nunca a un
  // punto de venta: el stock inicial es una compra que entra al almacén).
  if (formData.stock_inicial && formData.stock_inicial > 0) {
    let depositoId = formData.deposito_id ?? null;

    if (!depositoId) {
      const { data: fallback } = await supabase
        .from("depositos")
        .select("id")
        .eq("tipo", "deposito")
        .eq("activo", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      depositoId = fallback?.id ?? null;
    }

    if (!depositoId) {
      throw new Error(
        "No hay ninguna ubicación donde acreditar el stock inicial",
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("stock_inventario").upsert(
      {
        item_id: item.id,
        deposito_id: depositoId,
        cantidad: formData.stock_inicial,
      },
      { onConflict: "item_id,deposito_id" },
    );

    if (user) {
      await supabase.from("movimientos_stock").insert({
        item_id: item.id,
        deposito_id: depositoId,
        tipo: "ingreso",
        cantidad: formData.stock_inicial,
        motivo: "Stock inicial",
        usuario_id: user.id,
      });
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
