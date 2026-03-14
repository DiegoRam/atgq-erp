"use server";

import { createClient } from "@/lib/supabase/server";

interface VentaMensualRow {
  mes: string;
  cantidad: number;
  total: number;
  promedio: number;
}

export async function getVentasMensuales(anio: number): Promise<VentaMensualRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ventas")
    .select("fecha, total")
    .eq("anulada", false)
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31T23:59:59`);

  if (error) throw new Error(error.message);

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const grouped: Record<number, { cantidad: number; total: number }> = {};
  for (const row of data ?? []) {
    const month = new Date(row.fecha).getMonth();
    if (!grouped[month]) grouped[month] = { cantidad: 0, total: 0 };
    grouped[month].cantidad++;
    grouped[month].total += Number(row.total);
  }

  return meses.map((mes, i) => ({
    mes,
    cantidad: grouped[i]?.cantidad ?? 0,
    total: grouped[i]?.total ?? 0,
    promedio:
      grouped[i]?.cantidad > 0
        ? grouped[i].total / grouped[i].cantidad
        : 0,
  }));
}
