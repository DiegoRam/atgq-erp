"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  CategoriaMovimiento,
  CategoriaMovimientoFormData,
} from "@/types/tesoreria";

export async function getCategorias(): Promise<CategoriaMovimiento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_movimientos")
    .select("*")
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaMovimiento[];
}

export async function createCategoria(formData: CategoriaMovimientoFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("categorias_movimientos").insert({
    nombre: formData.nombre,
    tipo: formData.tipo,
    activa: formData.activa,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una categoría con ese nombre y tipo");
    }
    throw new Error(error.message);
  }
  revalidatePath("/tesoreria/config/categorias");
}

export async function updateCategoria(
  id: string,
  formData: CategoriaMovimientoFormData,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("categorias_movimientos")
    .update({
      nombre: formData.nombre,
      tipo: formData.tipo,
      activa: formData.activa,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una categoría con ese nombre y tipo");
    }
    throw new Error(error.message);
  }
  revalidatePath("/tesoreria/config/categorias");
}
