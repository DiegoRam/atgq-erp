"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Turno, TurnoFormData, Instalacion } from "@/types/actividades";

interface TurnosFilters {
  fecha?: string;
  instalacion_id?: string;
  estado?: string;
}

export async function getTurnos(filters: TurnosFilters = {}): Promise<Turno[]> {
  const supabase = createClient();

  let query = supabase
    .from("turnos")
    .select("*, socio:socios(id, nro_socio, apellido, nombre), instalacion:instalaciones(id, nombre)")
    .order("fecha_turno", { ascending: false })
    .order("hora_inicio", { ascending: true });

  if (filters.fecha) {
    query = query.eq("fecha_turno", filters.fecha);
  }
  if (filters.instalacion_id && filters.instalacion_id !== "todas") {
    query = query.eq("instalacion_id", filters.instalacion_id);
  }
  if (filters.estado && filters.estado !== "todos") {
    query = query.eq("estado", filters.estado);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Turno[];
}

export async function getInstalacionesActivas(): Promise<Instalacion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("instalaciones")
    .select("*")
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Instalacion[];
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

export async function createTurno(formData: TurnoFormData) {
  const supabase = createClient();

  // Validate overlap
  const { data: overlap } = await supabase
    .from("turnos")
    .select("id")
    .eq("instalacion_id", formData.instalacion_id)
    .eq("fecha_turno", formData.fecha_turno)
    .eq("estado", "confirmado")
    .lt("hora_inicio", formData.hora_fin)
    .gt("hora_fin", formData.hora_inicio)
    .limit(1);

  if (overlap && overlap.length > 0) {
    throw new Error(
      "Ya existe un turno en esa instalación que se superpone con el horario seleccionado",
    );
  }

  const { error } = await supabase.from("turnos").insert({
    socio_id: formData.socio_id,
    instalacion_id: formData.instalacion_id,
    fecha_turno: formData.fecha_turno,
    hora_inicio: formData.hora_inicio,
    hora_fin: formData.hora_fin,
    estado: "confirmado",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/turnos");
}

export async function cancelarTurno(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("turnos")
    .update({ estado: "cancelado" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/turnos");
}
