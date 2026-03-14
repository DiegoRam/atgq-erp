"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ItemVenta, NuevaVentaData } from "@/types/ventas";

export async function getItemsVentasActivos(): Promise<ItemVenta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("items_ventas")
    .select("*, stock_item:stock_items(id, nombre)")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemVenta[];
}

export async function getClientesForSelect() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, apellido, nombre")
    .order("apellido")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMetodosPago() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("metodos_cobranza")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSociosForAutocomplete(search: string) {
  const supabase = createClient();
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

export async function crearVenta(ventaData: NuevaVentaData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Calculate total
  const total = ventaData.items.reduce(
    (sum, item) => sum + item.cantidad * item.precio_unitario,
    0,
  );

  // Insert venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: ventaData.cliente_id || null,
      socio_id: ventaData.socio_id || null,
      fecha: new Date().toISOString(),
      total,
      metodo_pago_id: ventaData.metodo_pago_id,
      usuario_id: user.id,
      anulada: false,
    })
    .select("id")
    .single();

  if (ventaError) throw new Error(ventaError.message);

  // Insert venta items
  const ventaItems = ventaData.items.map((item) => ({
    venta_id: venta.id,
    item_id: item.item_id,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    subtotal: item.cantidad * item.precio_unitario,
  }));

  const { error: itemsError } = await supabase
    .from("ventas_items")
    .insert(ventaItems);

  if (itemsError) throw new Error(itemsError.message);

  // Deduct stock for linked items
  // Get items_ventas with stock_item_id
  const itemIds = ventaData.items.map((i) => i.item_id);
  const { data: itemsConStock } = await supabase
    .from("items_ventas")
    .select("id, stock_item_id")
    .in("id", itemIds)
    .not("stock_item_id", "is", null);

  if (itemsConStock && itemsConStock.length > 0) {
    // Get default deposito
    const { data: deposito } = await supabase
      .from("depositos")
      .select("id")
      .eq("nombre", "Deposito Central")
      .single();

    if (deposito) {
      for (const itemVenta of itemsConStock) {
        const cartItem = ventaData.items.find((i) => i.item_id === itemVenta.id);
        if (!cartItem || !itemVenta.stock_item_id) continue;

        // Insert stock movement (egreso)
        await supabase.from("movimientos_stock").insert({
          item_id: itemVenta.stock_item_id,
          deposito_id: deposito.id,
          tipo: "egreso",
          cantidad: cartItem.cantidad,
          motivo: `Venta #${venta.id.slice(0, 8)}`,
          referencia_id: venta.id,
          usuario_id: user.id,
        });

        // Update inventory
        const { data: existing } = await supabase
          .from("stock_inventario")
          .select("id, cantidad")
          .eq("item_id", itemVenta.stock_item_id)
          .eq("deposito_id", deposito.id)
          .single();

        if (existing) {
          await supabase
            .from("stock_inventario")
            .update({
              cantidad: existing.cantidad - cartItem.cantidad,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("stock_inventario").insert({
            item_id: itemVenta.stock_item_id,
            deposito_id: deposito.id,
            cantidad: -cartItem.cantidad,
          });
        }
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/ventas/nueva");
  revalidatePath("/stock");
  revalidatePath("/stock/items");

  return { success: true, ventaId: venta.id };
}
