"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ItemVenta, ItemVentaFormData } from "@/types/ventas";
import type { StockItem } from "@/types/stock";

export async function getItemsVentas(): Promise<ItemVenta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("items_ventas")
    .select("*, stock_item:stock_items(id, nombre)")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as ItemVenta[];
}

export async function getStockItemsForSelect(): Promise<StockItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as StockItem[];
}

export async function createItemVenta(formData: ItemVentaFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("items_ventas").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    precio: formData.precio,
    activo: formData.activo,
    stock_item_id: formData.stock_item_id || null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem de venta con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/items");
}

export async function updateItemVenta(id: string, formData: ItemVentaFormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("items_ventas")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      precio: formData.precio,
      activo: formData.activo,
      stock_item_id: formData.stock_item_id || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem de venta con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/items");
}
