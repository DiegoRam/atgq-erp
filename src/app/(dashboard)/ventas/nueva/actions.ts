"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
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
  return fetchAllRows<ItemVenta>((from, to) =>
    supabase
      .from("items_ventas")
      .select("*, stock_item:stock_items(id, nombre)")
      .eq("activo", true)
      .order("nombre")
      .order("id")
      .range(from, to),
  );
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
    // El término se interpola en la sintaxis de `or` de PostgREST: una coma,
    // un paréntesis o una comilla lo rompen y devuelven 500 ("failed to parse
    // logic tree"). Se sacan acá en vez de confiar en lo que tipeen.
    const term = search.replace(/[,()"%\\]/g, " ").trim();
    if (!term) return [];
    query = query.or(`apellido.ilike.%${term}%,nombre.ilike.%${term}%`);
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
    p_no_socio_nombre: parsed.data.no_socio_nombre || null,
    p_no_socio_dni: parsed.data.no_socio_dni || null,
    p_no_socio_credencial_venc:
      parsed.data.no_socio_credencial_vencimiento || null,
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
