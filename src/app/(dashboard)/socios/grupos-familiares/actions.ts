"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { revalidatePath } from "next/cache";
import type { GrupoFamiliar } from "@/types/socios";

export async function getGruposFamiliares(): Promise<GrupoFamiliar[]> {
  const supabase = await createClient();

  // fetchAllRows y no un .select() pelado: PostgREST corta en 1000 filas en
  // silencio. Importa además del listado en sí porque esta pantalla es la vía
  // para detectar los grupos sin titular, a los que la app móvil les niega las
  // cuotas del grupo — un conteo truncado escondería justo los que hay que arreglar.
  const grupos = await fetchAllRows<GrupoFamiliar>((desde, hasta) =>
    supabase
      .from("grupos_familiares")
      .select(
        "*, titular:socios!fk_grupos_familiares_titular(id,nro_socio,apellido,nombre)",
      )
      // Desempate por id: `created_at` no es único y sin él la paginación de
      // fetchAllRows puede repetir o saltear filas entre páginas.
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, hasta),
  );

  if (grupos.length === 0) return [];

  // Una sola consulta para todos los miembros en vez de una por grupo: el bucle
  // anterior hacía N+1 round-trips y con unos cientos de grupos la pantalla
  // tardaba o directamente se cortaba.
  const miembros = await fetchAllRows<{
    id: string;
    nro_socio: number;
    apellido: string;
    nombre: string;
    grupo_familiar_id: string;
  }>((desde, hasta) =>
    supabase
      .from("socios")
      .select("id,nro_socio,apellido,nombre,grupo_familiar_id")
      .in(
        "grupo_familiar_id",
        grupos.map((g) => g.id),
      )
      .order("apellido")
      .order("id")
      .range(desde, hasta),
  );

  const porGrupo = new Map<string, GrupoFamiliar["miembros"]>();
  for (const m of miembros) {
    const lista = porGrupo.get(m.grupo_familiar_id) ?? [];
    lista.push({
      id: m.id,
      nro_socio: m.nro_socio,
      apellido: m.apellido,
      nombre: m.nombre,
    });
    porGrupo.set(m.grupo_familiar_id, lista);
  }

  return grupos.map((g) => ({ ...g, miembros: porGrupo.get(g.id) ?? [] }));
}

export async function createGrupoFamiliar(titularId: string, miembroIds: string[]) {
  const supabase = await createClient();

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
  const supabase = await createClient();
  const { error } = await supabase
    .from("socios")
    .update({ grupo_familiar_id: grupoId })
    .eq("id", socioId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios/grupos-familiares");
}

export async function removeMiembroFromGrupo(socioId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("socios")
    .update({ grupo_familiar_id: null })
    .eq("id", socioId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios/grupos-familiares");
}

export async function searchSocios(query: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id,nro_socio,apellido,nombre")
    .or(`apellido.ilike.%${query}%,nombre.ilike.%${query}%`)
    .is("grupo_familiar_id", null)
    .limit(10);
  if (error) throw new Error(error.message);
  return data ?? [];
}
