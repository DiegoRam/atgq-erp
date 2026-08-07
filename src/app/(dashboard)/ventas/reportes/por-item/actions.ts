"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
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

/** Sin filtrar por `activo`: los reportes históricos necesitan los discontinuados. */
export async function getItemsVentasParaFiltro(): Promise<
  Pick<ItemVenta, "id" | "nombre" | "descripcion" | "activo">[]
> {
  const supabase = await createClient();
  return fetchAllRows<
    Pick<ItemVenta, "id" | "nombre" | "descripcion" | "activo">
  >((from, to) =>
    supabase
      .from("items_ventas")
      .select("id, nombre, descripcion, activo")
      .order("nombre")
      .order("id")
      .range(from, to),
  );
}

export async function getVentasPorItem(params: {
  item_id: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  punto_venta_id?: string;
}): Promise<VentaPorItemRow[]> {
  const supabase = await createClient();

  // Sin paginar, un ítem de alta rotación pasa las 1000 líneas y los totales del
  // reporte —unidades y monto, sumados en JS más abajo— quedan cortos sin avisar.
  const data = await fetchAllRows<{
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    venta: unknown;
  }>((from, to) =>
    supabase
      .from("ventas_items")
      .select(
        "cantidad, precio_unitario, subtotal, venta:ventas!inner(id, fecha, anulada, punto_venta_id, no_socio_nombre, punto_venta:depositos!punto_venta_id(nombre), cliente:clientes(apellido, nombre), socio:socios(nro_socio, apellido, nombre))",
      )
      .eq("item_id", params.item_id)
      .order("id")
      .range(from, to),
  );

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
