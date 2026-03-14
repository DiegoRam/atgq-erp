"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSociosPorLocalidad() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_socios_por_localidad");
  if (error) throw new Error(error.message);
  return (data ?? []) as { localidad: string; cantidad: number }[];
}
