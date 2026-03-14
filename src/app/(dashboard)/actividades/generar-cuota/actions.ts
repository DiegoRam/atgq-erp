"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getActividadesConInscriptos() {
  const supabase = createClient();

  const { data: actividades, error } = await supabase
    .from("actividades")
    .select("id, nombre, monto_cuota")
    .eq("activa", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!actividades || actividades.length === 0) return [];

  // Count inscriptos per actividad
  const ids = actividades.map((a) => a.id);
  const { data: inscripciones } = await supabase
    .from("socios_actividades")
    .select("actividad_id")
    .in("actividad_id", ids)
    .eq("activa", true);

  const counts: Record<string, number> = {};
  if (inscripciones) {
    for (const row of inscripciones) {
      counts[row.actividad_id] = (counts[row.actividad_id] ?? 0) + 1;
    }
  }

  // Only return actividades with inscriptos > 0
  return actividades
    .filter((a) => (counts[a.id] ?? 0) > 0)
    .map((a) => ({
      ...a,
      inscriptos_count: counts[a.id] ?? 0,
    }));
}

export async function previewGeneracion(actividadId: string, periodo: string) {
  const supabase = createClient();

  // Count inscriptos activos
  const { count, error } = await supabase
    .from("socios_actividades")
    .select("id", { count: "exact", head: true })
    .eq("actividad_id", actividadId)
    .eq("activa", true);

  if (error) throw new Error(error.message);

  // Get actividad info
  const { data: actividad } = await supabase
    .from("actividades")
    .select("nombre")
    .eq("id", actividadId)
    .single();

  return {
    count: count ?? 0,
    actividad: actividad?.nombre ?? "",
    periodo,
  };
}

export async function generarCuotaActividad(
  actividadId: string,
  periodo: string,
  monto: number,
) {
  const supabase = createClient();

  // 1. Get tipo_cuota_id for 'Cuota Actividad'
  const { data: tipoCuota } = await supabase
    .from("tipos_cuotas")
    .select("id")
    .eq("nombre", "Cuota Actividad")
    .single();

  if (!tipoCuota) throw new Error("No se encontró el tipo de cuota 'Cuota Actividad'");

  // 2. Get inscriptos activos
  const { data: inscriptos, error: inscError } = await supabase
    .from("socios_actividades")
    .select("socio_id")
    .eq("actividad_id", actividadId)
    .eq("activa", true);

  if (inscError) throw new Error(inscError.message);
  if (!inscriptos || inscriptos.length === 0) return { count: 0, total: 0 };

  // 3. Bulk INSERT into cuotas
  const cuotas = inscriptos.map((s) => ({
    socio_id: s.socio_id,
    tipo_cuota_id: tipoCuota.id,
    periodo,
    monto,
    pagada: false,
  }));

  const { error } = await supabase.from("cuotas").insert(cuotas);
  if (error) throw new Error(error.message);

  revalidatePath("/actividades");
  revalidatePath("/socios");

  return { count: cuotas.length, total: cuotas.length * monto };
}
