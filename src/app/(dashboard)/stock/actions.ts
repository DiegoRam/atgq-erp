"use server";

import { createClient } from "@/lib/supabase/server";
import type { InventarioRow } from "@/types/stock";

export async function getInventario(): Promise<InventarioRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_inventario")
    .select(
      "*, item:stock_items!item_id(id, nombre, unidad), deposito:depositos!deposito_id(id, nombre)",
    )
    .order("deposito_id")
    .order("item_id");

  if (error) throw new Error(error.message);
  return (data ?? []) as InventarioRow[];
}
