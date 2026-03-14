"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TipoCuota, TipoCuotaFormData } from "@/types/socios";

export async function getTiposCuotas(): Promise<TipoCuota[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tipos_cuotas")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTipoCuota(formData: TipoCuotaFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { error } = await supabase.from("tipos_cuotas").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    activo: formData.activo,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un tipo de cuota con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/tipo-cuotas");
}

export async function updateTipoCuota(id: string, formData: TipoCuotaFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  if (!formData.activo) {
    const { data: cuotasActivas } = await supabase
      .from("cuotas")
      .select("id")
      .eq("tipo_cuota_id", id)
      .eq("pagada", false)
      .limit(1);

    if (cuotasActivas && cuotasActivas.length > 0) {
      throw new Error("No se puede desactivar un tipo de cuota con cuotas impagas");
    }
  }

  const { error } = await supabase
    .from("tipos_cuotas")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      activo: formData.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un tipo de cuota con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/tipo-cuotas");
}
