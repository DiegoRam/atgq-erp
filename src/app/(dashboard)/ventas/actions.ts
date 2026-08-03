"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Venta,
  VentaItem,
  VentasSearchParams,
  AnularVentaResult,
} from "@/types/ventas";

/** Puntos de venta para el filtro del listado */
export async function getPuntosVentaParaFiltro() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("depositos")
    .select("id, nombre")
    .eq("tipo", "punto_venta")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVentas(params: VentasSearchParams) {
  const supabase = createClient();
  const { page, pageSize, fecha_desde, fecha_hasta, estado, punto_venta_id } =
    params;

  let query = supabase
    .from("ventas")
    .select(
      "*, cliente:clientes(id, apellido, nombre), socio:socios(id, nro_socio, apellido, nombre), metodo_pago:metodos_cobranza!metodo_pago_id(id, nombre), punto_venta:depositos!punto_venta_id(id, nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false });

  if (fecha_desde) query = query.gte("fecha", fecha_desde);
  if (fecha_hasta) query = query.lte("fecha", `${fecha_hasta}T23:59:59`);
  if (estado === "activas") query = query.eq("anulada", false);
  if (estado === "anuladas") query = query.eq("anulada", true);
  if (punto_venta_id) query = query.eq("punto_venta_id", punto_venta_id);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  // Get item counts per venta
  const ventaIds = (data ?? []).map((v) => v.id);
  const itemCounts: Record<string, number> = {};

  if (ventaIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("ventas_items")
      .select("venta_id, cantidad")
      .in("venta_id", ventaIds);

    if (itemsData) {
      for (const item of itemsData) {
        itemCounts[item.venta_id] =
          (itemCounts[item.venta_id] ?? 0) + item.cantidad;
      }
    }
  }

  const ventas = (data ?? []).map((v) => ({
    ...v,
    items_count: itemCounts[v.id] ?? 0,
  })) as Venta[];

  return { data: ventas, count: count ?? 0 };
}

export async function getVentaDetalle(
  ventaId: string,
): Promise<VentaItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ventas_items")
    .select("*, item:items_ventas(id, nombre)")
    .eq("venta_id", ventaId)
    .order("created_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as VentaItem[];
}

export async function anularVenta(
  ventaId: string,
  motivo?: string,
): Promise<AnularVentaResult> {
  const supabase = createClient();

  // RPC atómica: marca la venta, restituye el stock en el punto de venta
  // que registró el egreso y compensa el ingreso en caja con un egreso
  const { data, error } = await supabase.rpc("anular_venta", {
    p_venta_id: ventaId,
    p_motivo: motivo || null,
  });
  if (error) throw new Error(error.message);

  const row = (data as AnularVentaResult[] | null)?.[0];

  revalidatePath("/ventas");
  revalidatePath("/stock");
  revalidatePath("/tesoreria/cajas");
  revalidatePath("/tesoreria/movimientos");

  return {
    items_restituidos: row?.items_restituidos ?? 0,
    movimiento_fondo_id: row?.movimiento_fondo_id ?? null,
  };
}
