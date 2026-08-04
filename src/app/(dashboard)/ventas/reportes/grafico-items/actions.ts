"use server";

import { createClient } from "@/lib/supabase/server";

interface ItemRevenue {
  nombre: string;
  total: number;
}

export async function getTopItemsPorRevenue(params: {
  fecha_desde?: string;
  fecha_hasta?: string;
  punto_venta_id?: string;
}): Promise<ItemRevenue[]> {
  const supabase = await createClient();

  // Get all ventas_items with item name, filtering by venta date
  const query = supabase
    .from("ventas_items")
    .select(
      "subtotal, item:items_ventas(nombre), venta:ventas!inner(fecha, anulada, punto_venta_id)",
    );

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const grouped: Record<string, number> = {};
  for (const row of data ?? []) {
    const venta = row.venta as unknown as {
      fecha: string;
      anulada: boolean;
      punto_venta_id: string;
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

    const itemName =
      (row.item as unknown as { nombre: string })?.nombre ?? "Desconocido";
    grouped[itemName] = (grouped[itemName] ?? 0) + Number(row.subtotal);
  }

  return Object.entries(grouped)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}
