"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { transferenciaStockSchema } from "@/lib/schemas/stock";
import type {
  Deposito,
  StockItem,
  MovimientoStock,
  TransferenciaStockFormData,
  TransferenciaStockResult,
} from "@/types/stock";

/** Depósitos y puntos de venta activos: cualquiera puede ser origen o destino */
export async function getUbicacionesActivas(): Promise<Deposito[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("*")
    .eq("activo", true)
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposito[];
}

export async function getStockItemsActivos(): Promise<StockItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as StockItem[];
}

/** Existencias de un ítem en todas las ubicaciones, para mostrar el disponible */
export async function getStockPorUbicacion(
  itemId: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_inventario")
    .select("deposito_id, cantidad")
    .eq("item_id", itemId);
  if (error) throw new Error(error.message);

  const porUbicacion: Record<string, number> = {};
  for (const row of data ?? []) {
    porUbicacion[row.deposito_id] = row.cantidad;
  }
  return porUbicacion;
}

export async function transferirStock(formData: TransferenciaStockFormData) {
  const supabase = await createClient();

  const parsed = transferenciaStockSchema.safeParse(formData);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  // RPC atómica: las dos patas del movimiento y los dos ajustes de
  // inventario ocurren en una única transacción
  const { data, error } = await supabase.rpc("transferir_stock", {
    p_item_id: parsed.data.item_id,
    p_deposito_origen_id: parsed.data.deposito_origen_id,
    p_deposito_destino_id: parsed.data.deposito_destino_id,
    p_cantidad: parsed.data.cantidad,
    p_motivo: parsed.data.motivo || null,
  });
  if (error) throw new Error(error.message);

  const row = (data as TransferenciaStockResult[] | null)?.[0];

  revalidatePath("/stock");
  revalidatePath("/stock/movimientos");
  revalidatePath("/stock/transferencias");
  revalidatePath("/stock/items");

  return {
    ...row,
    warning:
      row && row.stock_origen < 0
        ? "El stock de la ubicación origen quedó en negativo"
        : undefined,
  };
}

/**
 * Las transferencias se listan por su pata de egreso, igual que
 * getUltimasTransferencias en tesorería.
 */
export async function getUltimasTransferenciasStock(): Promise<
  MovimientoStock[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select(
      "*, item:stock_items(id, nombre), deposito:depositos!deposito_id(id, nombre, tipo), deposito_destino:depositos!deposito_destino_id(id, nombre)",
    )
    .eq("tipo", "egreso")
    .not("deposito_destino_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoStock[];
}
