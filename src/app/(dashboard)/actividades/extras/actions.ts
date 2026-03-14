"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActividadExtra, ActividadExtraFormData } from "@/types/actividades";

export async function getActividadesExtras(): Promise<ActividadExtra[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("actividades_extras")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActividadExtra[];
}

export async function createActividadExtra(formData: ActividadExtraFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("actividades_extras").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    fecha: formData.fecha || null,
    monto: formData.monto ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/actividades/extras");
}

export async function updateActividadExtra(id: string, formData: ActividadExtraFormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("actividades_extras")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      fecha: formData.fecha || null,
      monto: formData.monto ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/actividades/extras");
}
