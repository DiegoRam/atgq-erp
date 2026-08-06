"use server";

import { createClient } from "@/lib/supabase/server";
import type { ItemVenta } from "@/types/ventas";

interface VentaPorItemRow {
  fecha: string;
  nro_venta: string;
  cliente: string;
  punto_venta: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export async function getItemsVentasParaFiltro(): Promise<
  Pick<ItemVenta, "id" | "nombre">[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items_ventas")
    .select("id, nombre")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVentasPorItem(params: {
  item_id: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  punto_venta_id?: string;
}): Promise<VentaPorItemRow[]> {
  const supabase = await createClient();

  const query = supabase
    .from("ventas_items")
    .select(
      "cantidad, precio_unitario, subtotal, venta:ventas!inner(id, fecha, anulada, punto_venta_id, no_socio_nombre, punto_venta:depositos!punto_venta_id(nombre), cliente:clientes(apellido, nombre), socio:socios(nro_socio, apellido, nombre))",
    )
    .eq("item_id", params.item_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Filter by date and anulada in JS (needed because of nested joins)
  const results: VentaPorItemRow[] = [];
  for (const row of data ?? []) {
    const venta = row.venta as unknown as {
      id: string;
      fecha: string;
      anulada: boolean;
      punto_venta_id: string;
      no_socio_nombre: string | null;
      punto_venta: { nombre: string } | null;
      cliente: { apellido: string; nombre: string } | null;
      socio: { nro_socio: number; apellido: string; nombre: string } | null;
    };

    if (venta.anulada) continue;
    if (
      params.punto_venta_id &&
      venta.punto_venta_id !== params.punto_venta_id
    )
      continue;

    if (params.fecha_desde && venta.fecha < params.fecha_desde) continue;
    if (
      params.fecha_hasta &&
      venta.fecha > `${params.fecha_hasta}T23:59:59`
    )
      continue;

    let clienteStr = "—";
    if (venta.socio) {
      clienteStr = `#${venta.socio.nro_socio} ${venta.socio.apellido}, ${venta.socio.nombre}`;
    } else if (venta.cliente) {
      clienteStr = `${venta.cliente.apellido}, ${venta.cliente.nombre}`;
    } else if (venta.no_socio_nombre) {
      clienteStr = `${venta.no_socio_nombre} (No socio)`;
    }

    results.push({
      fecha: venta.fecha,
      nro_venta: venta.id.slice(0, 8).toUpperCase(),
      cliente: clienteStr,
      punto_venta: venta.punto_venta?.nombre ?? "—",
      cantidad: row.cantidad,
      precio_unitario: Number(row.precio_unitario),
      subtotal: Number(row.subtotal),
    });
  }

  return results.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
