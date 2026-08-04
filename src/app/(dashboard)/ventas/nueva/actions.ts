"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { nuevaVentaSchema } from "@/lib/schemas/ventas";
import type {
  ItemVenta,
  NuevaVentaData,
  CrearVentaResult,
} from "@/types/ventas";
import type { Deposito } from "@/types/stock";

/** Sectores del club habilitados para vender */
export async function getPuntosVentaActivos(): Promise<Deposito[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("id, nombre, descripcion, activo, tipo, caja_id, created_at")
    .eq("tipo", "punto_venta")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Deposito[];
}

export async function getItemsVentasActivos(): Promise<ItemVenta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items_ventas")
    .select("*, stock_item:stock_items(id, nombre)")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemVenta[];
}

export async function getClientesForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, apellido, nombre")
    .order("apellido")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMetodosPago() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metodos_cobranza")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSociosForAutocomplete(search: string) {
  const supabase = await createClient();
  if (!search || search.length < 2) return [];

  const isNumeric = /^\d+$/.test(search);

  let query = supabase
    .from("socios")
    .select("id, nro_socio, apellido, nombre")
    .is("fecha_baja", null)
    .limit(10);

  if (isNumeric) {
    query = query.eq("nro_socio", parseInt(search));
  } else {
    query = query.or(
      `apellido.ilike.%${search}%,nombre.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearVenta(
  ventaData: NuevaVentaData,
): Promise<CrearVentaResult> {
  const supabase = await createClient();

  const parsed = nuevaVentaSchema.safeParse(ventaData);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  // RPC atómica: cabecera, ítems, egreso de stock del punto de venta e
  // ingreso en su caja ocurren en una sola transacción. Los precios los
  // resuelve el servidor desde items_ventas, no viajan desde el browser.
  const { data, error } = await supabase.rpc("registrar_venta", {
    p_punto_venta_id: parsed.data.punto_venta_id,
    p_cliente_id: parsed.data.cliente_id || null,
    p_socio_id: parsed.data.socio_id || null,
    p_metodo_pago_id: parsed.data.metodo_pago_id,
    p_items: parsed.data.items,
  });
  if (error) throw new Error(error.message);

  const row = (data as CrearVentaResult[] | null)?.[0];
  if (!row) throw new Error("No se pudo registrar la venta");

  revalidatePath("/ventas");
  revalidatePath("/ventas/nueva");
  revalidatePath("/stock");
  revalidatePath("/stock/items");
  revalidatePath("/tesoreria/cajas");
  revalidatePath("/tesoreria/movimientos");

  return {
    ...row,
    venta_total: Number(row.venta_total),
    items_negativos: row.items_negativos ?? [],
  };
}
