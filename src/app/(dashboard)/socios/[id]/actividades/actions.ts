"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SocioActividad } from "@/types/actividades";

export async function getActividadesBySocio(socioId: string): Promise<SocioActividad[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios_actividades")
    .select("*, actividad:actividades(id, nombre, monto_cuota)")
    .eq("socio_id", socioId)
    .eq("activa", true)
    .order("fecha_inscripcion", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocioActividad[];
}

export async function getActividadesDisponibles() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("actividades")
    .select("id, nombre, monto_cuota")
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function inscribirEnActividad(socioId: string, actividadId: string) {
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
  revalidatePath(`/socios/${socioId}/actividades`);
  revalidatePath("/actividades");
}

export async function darDeBaja(socioActividadId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("socios_actividades")
    .update({ activa: false })
    .eq("id", socioActividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios");
  revalidatePath("/actividades");
}

export async function getSocioById(socioId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id, nro_socio, apellido, nombre")
    .eq("id", socioId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
