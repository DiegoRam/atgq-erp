"use server";

import { createClient } from "@/lib/supabase/server";

interface VentaMensualChart {
  mes: string;
  total: number;
}

export async function getVentasMensualesChart(
  puntoVentaId?: string,
): Promise<VentaMensualChart[]> {
  const supabase = await createClient();

  const doceAtras = new Date();
  doceAtras.setMonth(doceAtras.getMonth() - 12);

  let query = supabase
    .from("ventas")
    .select("fecha, total")
    .eq("anulada", false)
    .gte("fecha", doceAtras.toISOString());

  if (puntoVentaId) query = query.eq("punto_venta_id", puntoVentaId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const meses = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  const grouped: Record<string, number> = {};
  for (const row of data ?? []) {
    const d = new Date(row.fecha);
    const key = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    grouped[key] = (grouped[key] ?? 0) + Number(row.total);
  }

  const result: VentaMensualChart[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    result.push({ mes: key, total: grouped[key] ?? 0 });
  }

  return result;
}
