"use server";

import { createClient } from "@/lib/supabase/server";
import type { SocioMoroso } from "@/types/socios";

export async function getSociosMorosos(page: number, pageSize: number) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_socios_morosos", {
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw new Error(error.message);

  const { data: countData, error: countError } = await supabase.rpc(
    "get_socios_morosos_count",
  );

  if (countError) throw new Error(countError.message);

  return {
    data: (data ?? []) as SocioMoroso[],
    count: Number(countData ?? 0),
  };
}

export async function getAllMorosos(): Promise<SocioMoroso[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_socios_morosos", {
    p_page: 1,
    p_page_size: 100000,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocioMoroso[];
}
