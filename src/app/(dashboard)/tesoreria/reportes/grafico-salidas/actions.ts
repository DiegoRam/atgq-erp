"use server";

import { createClient } from "@/lib/supabase/server";

interface EgresoPorCategoria {
  categoria: string;
  total: number;
}

export async function getEgresosPorCategoria(params: {
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<EgresoPorCategoria[]> {
  const supabase = createClient();

  let query = supabase
    .from("movimientos_fondos")
    .select("monto, categoria:categorias_movimientos(nombre)")
    .eq("tipo", "egreso");

  if (params.fecha_desde) query = query.gte("fecha", params.fecha_desde);
  if (params.fecha_hasta)
    query = query.lte("fecha", `${params.fecha_hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Group by category
  const grouped: Record<string, number> = {};
  for (const row of data ?? []) {
    const catName =
      (row.categoria as unknown as { nombre: string })?.nombre ?? "Sin categoría";
    grouped[catName] = (grouped[catName] ?? 0) + Number(row.monto);
  }

  return Object.entries(grouped)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}
