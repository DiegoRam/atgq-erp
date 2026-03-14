"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function inscribirSocio(actividadId: string, socioId: string) {
  const supabase = createClient();

  // Check if there's an existing (inactive) inscription to reactivate
  const { data: existing } = await supabase
    .from("socios_actividades")
    .select("id, activa")
    .eq("socio_id", socioId)
    .eq("actividad_id", actividadId)
    .single();

  if (existing) {
    if (existing.activa) {
      throw new Error("El socio ya está inscripto en esta actividad");
    }
    // Reactivate
    const { error } = await supabase
      .from("socios_actividades")
      .update({ activa: true, fecha_inscripcion: new Date().toISOString().split("T")[0] })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("socios_actividades").insert({
      socio_id: socioId,
      actividad_id: actividadId,
      activa: true,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/actividades/${actividadId}`);
  revalidatePath("/actividades");
}

export async function darDeBajaSocio(socioActividadId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("socios_actividades")
    .update({ activa: false })
    .eq("id", socioActividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/actividades");
}

export async function getSociosForAutocomplete(search: string) {
  const supabase = createClient();
  if (!search || search.length < 2) return [];

  const isNumeric = /^\d+$/.test(search);

  let query = supabase
    .from("socios")
    .select("id, nro_socio, apellido, nombre")
    .is("fecha_baja", null)
    .limit(10);

  if (isNumeric) {
    query = query.eq("nro_socio", parseInt(search));
  } else {
    query = query.or(
      `apellido.ilike.%${search}%,nombre.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
