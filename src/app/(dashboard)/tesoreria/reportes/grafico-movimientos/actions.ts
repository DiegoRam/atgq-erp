"use server";

import { createClient } from "@/lib/supabase/server";
import type { Caja } from "@/types/tesoreria";

interface IngresoMensual {
  mes: string;
  total: number;
}

export async function getIngresosMensuales(params: {
  caja_id?: string;
}): Promise<IngresoMensual[]> {
  const supabase = createClient();

  // Get last 12 months of income data
  const doceAtras = new Date();
  doceAtras.setMonth(doceAtras.getMonth() - 12);

  let query = supabase
    .from("movimientos_fondos")
    .select("fecha, monto")
    .eq("tipo", "ingreso")
    .gte("fecha", doceAtras.toISOString());

  if (params.caja_id) query = query.eq("caja_id", params.caja_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Group by month
  const grouped: Record<string, number> = {};
  const meses = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  for (const row of data ?? []) {
    const d = new Date(row.fecha);
    const key = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    grouped[key] = (grouped[key] ?? 0) + Number(row.monto);
  }

  // Generate all 12 months (ensure no gaps)
  const result: IngresoMensual[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${meses[d.getMonth()]} ${d.getFullYear()}`;
    result.push({ mes: key, total: grouped[key] ?? 0 });
  }

  return result;
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
