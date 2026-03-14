"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSociosPorEdad() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_socios_por_edad");
  if (error) throw new Error(error.message);
  return (data ?? []) as { rango: string; cantidad: number }[];
}
