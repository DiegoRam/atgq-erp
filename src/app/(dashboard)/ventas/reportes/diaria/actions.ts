"use server";

import { createClient } from "@/lib/supabase/server";

interface VentaDiariaRow {
  fecha: string;
  cantidad: number;
  total: number;
}

export async function getVentasDiarias(
  anio: number,
  mes: number,
): Promise<VentaDiariaRow[]> {
  const supabase = createClient();

  const mesStr = String(mes).padStart(2, "0");
  const desde = `${anio}-${mesStr}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const hasta = `${anio}-${mesStr}-${lastDay}T23:59:59`;

  const { data, error } = await supabase
    .from("ventas")
    .select("fecha, total")
    .eq("anulada", false)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (error) throw new Error(error.message);

  const grouped: Record<string, { cantidad: number; total: number }> = {};
  for (const row of data ?? []) {
    const day = new Date(row.fecha).toISOString().slice(0, 10);
    if (!grouped[day]) grouped[day] = { cantidad: 0, total: 0 };
    grouped[day].cantidad++;
    grouped[day].total += Number(row.total);
  }

  return Object.entries(grouped)
    .map(([fecha, vals]) => ({ fecha, ...vals }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
