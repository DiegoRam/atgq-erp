"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GrupoFamiliar } from "@/types/socios";

export async function getGruposFamiliares(): Promise<GrupoFamiliar[]> {
  const supabase = createClient();

  const { data: grupos, error } = await supabase
    .from("grupos_familiares")
    .select("*, titular:socios!fk_grupos_familiares_titular(id,nro_socio,apellido,nombre)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // For each grupo, fetch members
  const result: GrupoFamiliar[] = [];
  for (const g of grupos ?? []) {
    const { data: miembros } = await supabase
      .from("socios")
      .select("id,nro_socio,apellido,nombre")
      .eq("grupo_familiar_id", g.id)
      .order("apellido");

    result.push({
      ...g,
      miembros: miembros ?? [],
    });
  }

  return result;
}

export async function createGrupoFamiliar(titularId: string, miembroIds: string[]) {
  const supabase = createClient();

  const { data: grupo, error: gError } = await supabase
    .from("grupos_familiares")
    .insert({ titular_id: titularId })
    .select()
    .single();

  if (gError) throw new Error(gError.message);

  // Assign all members (including titular) to the grupo
  const allIds = [titularId, ...miembroIds];
  const { error: uError } = await supabase
    .from("socios")
    .update({ grupo_familiar_id: grupo.id })
    .in("id", allIds);

  if (uError) throw new Error(uError.message);

  revalidatePath("/socios/grupos-familiares");
}

export async function addMiembroToGrupo(grupoId: string, socioId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("socios")
    .update({ grupo_familiar_id: grupoId })
    .eq("id", socioId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios/grupos-familiares");
}

export async function removeMiembroFromGrupo(socioId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("socios")
    .update({ grupo_familiar_id: null })
    .eq("id", socioId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios/grupos-familiares");
}

export async function searchSocios(query: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id,nro_socio,apellido,nombre")
    .or(`apellido.ilike.%${query}%,nombre.ilike.%${query}%`)
    .is("grupo_familiar_id", null)
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}
