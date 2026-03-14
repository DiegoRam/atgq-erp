"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CategoriaSocial, CategoriaSocialFormData } from "@/types/socios";

export async function getCategoriasSociales(): Promise<CategoriaSocial[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_sociales")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategoriaSocial(formData: CategoriaSocialFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { error } = await supabase.from("categorias_sociales").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    monto_base: formData.monto_base ?? null,
    activa: formData.activa,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una categoría con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/categorias");
}

export async function updateCategoriaSocial(id: string, formData: CategoriaSocialFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  if (!formData.activa) {
    const { data: sociosActivos } = await supabase
      .from("socios")
      .select("id")
      .eq("categoria_id", id)
      .is("fecha_baja", null)
      .limit(1);

    if (sociosActivos && sociosActivos.length > 0) {
      throw new Error("No se puede desactivar una categoría con socios activos");
    }
  }

  const { error } = await supabase
    .from("categorias_sociales")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      monto_base: formData.monto_base ?? null,
      activa: formData.activa,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una categoría con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/categorias");
}
