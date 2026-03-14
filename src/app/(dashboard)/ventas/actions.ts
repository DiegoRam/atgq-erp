"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Venta, VentaItem, VentasSearchParams } from "@/types/ventas";

export async function getVentas(params: VentasSearchParams) {
  const supabase = createClient();
  const { page, pageSize, fecha_desde, fecha_hasta, estado } = params;

  let query = supabase
    .from("ventas")
    .select(
      "*, cliente:clientes(id, apellido, nombre), socio:socios(id, nro_socio, apellido, nombre), metodo_pago:metodos_cobranza!metodo_pago_id(id, nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false });

  if (fecha_desde) query = query.gte("fecha", fecha_desde);
  if (fecha_hasta) query = query.lte("fecha", `${fecha_hasta}T23:59:59`);
  if (estado === "activas") query = query.eq("anulada", false);
  if (estado === "anuladas") query = query.eq("anulada", true);

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

export async function anularVenta(ventaId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("ventas")
    .update({ anulada: true })
    .eq("id", ventaId);

  if (error) throw new Error(error.message);
  revalidatePath("/ventas");
}
