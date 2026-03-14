"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPadron(categoriaId?: string) {
  const supabase = createClient();

  // Get BAJA category to exclude
  const { data: bajaCat } = await supabase
    .from("categorias_sociales")
    .select("id")
    .eq("nombre", "BAJA")
    .single();

  let query = supabase
    .from("socios")
    .select("*, categoria:categorias_sociales(id,nombre)")
    .is("fecha_baja", null)
    .order("apellido");

  if (bajaCat) {
    query = query.neq("categoria_id", bajaCat.id);
  }

  if (categoriaId) {
    query = query.eq("categoria_id", categoriaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
