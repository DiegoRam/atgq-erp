"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Actividad, ActividadFormData } from "@/types/actividades";

export async function getActividades(): Promise<Actividad[]> {
  const supabase = createClient();

  const { data: actividades, error } = await supabase
    .from("actividades")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!actividades || actividades.length === 0) return [];

  // Count active inscriptos per actividad
  const actividadIds = actividades.map((a) => a.id);
  const { data: inscripciones } = await supabase
    .from("socios_actividades")
    .select("actividad_id")
    .in("actividad_id", actividadIds)
    .eq("activa", true);

  const counts: Record<string, number> = {};
  if (inscripciones) {
    for (const row of inscripciones) {
      counts[row.actividad_id] = (counts[row.actividad_id] ?? 0) + 1;
    }
  }

  return actividades.map((a) => ({
    ...a,
    inscriptos_count: counts[a.id] ?? 0,
  })) as Actividad[];
}

export async function getActividadById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("actividades")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Actividad;
}

export async function getInscriptosByActividad(actividadId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios_actividades")
    .select("*, socio:socios(id, nro_socio, apellido, nombre)")
    .eq("actividad_id", actividadId)
    .eq("activa", true)
    .order("fecha_inscripcion", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createActividad(formData: ActividadFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("actividades").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    monto_cuota: formData.monto_cuota ?? null,
    activa: formData.activa,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una actividad con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/actividades");
}

export async function updateActividad(id: string, formData: ActividadFormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("actividades")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      monto_cuota: formData.monto_cuota ?? null,
      activa: formData.activa,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una actividad con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/actividades");
}
