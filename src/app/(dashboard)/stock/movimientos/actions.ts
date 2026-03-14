"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  MovimientoStock,
  MovimientosStockSearchParams,
  Deposito,
  StockItem,
} from "@/types/stock";

export async function getMovimientosStock(
  params: MovimientosStockSearchParams,
) {
  const supabase = createClient();
  const { page, pageSize, item_id, deposito_id, tipo, fecha_desde, fecha_hasta } =
    params;

  let query = supabase
    .from("movimientos_stock")
    .select(
      "*, item:stock_items!item_id(id,nombre), deposito:depositos!deposito_id(id,nombre)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (item_id) query = query.eq("item_id", item_id);
  if (deposito_id) query = query.eq("deposito_id", deposito_id);
  if (tipo) query = query.eq("tipo", tipo);
  if (fecha_desde) query = query.gte("created_at", fecha_desde);
  if (fecha_hasta) query = query.lte("created_at", `${fecha_hasta}T23:59:59`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    data: (data ?? []) as MovimientoStock[],
    count: count ?? 0,
  };
}

export async function getItemsParaFiltro(): Promise<StockItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as StockItem[];
}

export async function getDepositosParaFiltro(): Promise<Deposito[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposito[];
}
