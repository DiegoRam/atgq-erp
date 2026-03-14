"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCuotasMensuales(fechaDesde: string, fechaHasta: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_cuotas_mensuales", {
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as { mes: string; cuotas_pagadas: number; monto: number }[];
}
