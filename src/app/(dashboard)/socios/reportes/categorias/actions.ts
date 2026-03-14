"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSociosPorCategoria() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_socios_por_categoria");
  if (error) throw new Error(error.message);
  return (data ?? []) as { categoria: string; cantidad: number }[];
}
