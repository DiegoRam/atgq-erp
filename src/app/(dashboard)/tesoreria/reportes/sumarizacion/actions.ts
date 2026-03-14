"use server";

import { createClient } from "@/lib/supabase/server";
import type { Caja } from "@/types/tesoreria";

interface SumarizacionRow {
  categoria: string;
  tipo: string;
  cantidad: number;
  total: number;
}

export async function getSumarizacion(params: {
  fecha_desde?: string;
  fecha_hasta?: string;
  caja_id?: string;
}): Promise<SumarizacionRow[]> {
  const supabase = createClient();

  let query = supabase
    .from("movimientos_fondos")
    .select("tipo, monto, categoria:categorias_movimientos(nombre)");

  if (params.caja_id) query = query.eq("caja_id", params.caja_id);
  if (params.fecha_desde) query = query.gte("fecha", params.fecha_desde);
  if (params.fecha_hasta)
    query = query.lte("fecha", `${params.fecha_hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Group by categoria + tipo
  const grouped: Record<string, { tipo: string; cantidad: number; total: number }> = {};
  for (const row of data ?? []) {
    const catName =
      (row.categoria as unknown as { nombre: string })?.nombre ?? "Sin categoría";
    const key = `${catName}-${row.tipo}`;
    if (!grouped[key]) {
      grouped[key] = { tipo: row.tipo, cantidad: 0, total: 0 };
    }
    grouped[key].cantidad++;
    grouped[key].total += Number(row.monto);
  }

  return Object.entries(grouped)
    .map(([key, val]) => ({
      categoria: key.split("-").slice(0, -1).join("-"),
      tipo: val.tipo,
      cantidad: val.cantidad,
      total: val.total,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getCajasParaFiltro(): Promise<Caja[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Caja[];
}
