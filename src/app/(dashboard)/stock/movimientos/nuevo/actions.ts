"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Deposito,
  StockItem,
  MovimientoStockFormData,
} from "@/types/stock";

export async function getDepositosActivos(): Promise<Deposito[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposito[];
}

export async function getStockItemsActivos(): Promise<StockItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as StockItem[];
}

export async function getStockActual(
  depositoId: string,
  itemId: string,
): Promise<number | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_inventario")
    .select("cantidad")
    .eq("deposito_id", depositoId)
    .eq("item_id", itemId)
    .single();
  return data?.cantidad ?? null;
}

export async function registrarMovimientoStock(
  formData: MovimientoStockFormData,
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Insert movement
  const { error: movError } = await supabase.from("movimientos_stock").insert({
    item_id: formData.item_id,
    deposito_id: formData.deposito_id,
    tipo: formData.tipo,
    cantidad: formData.cantidad,
    motivo: formData.motivo || null,
    usuario_id: user.id,
  });
  if (movError) throw new Error(movError.message);

  // UPSERT stock_inventario
  const delta =
    formData.tipo === "ingreso" ? formData.cantidad : -formData.cantidad;

  const { data: existing } = await supabase
    .from("stock_inventario")
    .select("id, cantidad")
    .eq("item_id", formData.item_id)
    .eq("deposito_id", formData.deposito_id)
    .single();

  let nuevoStock: number;

  if (existing) {
    nuevoStock = existing.cantidad + delta;
    await supabase
      .from("stock_inventario")
      .update({ cantidad: nuevoStock, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    nuevoStock = delta;
    await supabase.from("stock_inventario").insert({
      item_id: formData.item_id,
      deposito_id: formData.deposito_id,
      cantidad: nuevoStock,
    });
  }

  revalidatePath("/stock");
  revalidatePath("/stock/movimientos");
  revalidatePath("/stock/items");

  return {
    success: true,
    nuevoStock,
    warning: nuevoStock < 0 ? "El stock quedó en negativo" : undefined,
  };
}
