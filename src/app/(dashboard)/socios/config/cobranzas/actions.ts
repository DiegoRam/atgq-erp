"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MetodoCobranza, MetodoCobranzaFormData } from "@/types/socios";

export async function getMetodosCobranza(): Promise<MetodoCobranza[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("metodos_cobranza")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createMetodoCobranza(formData: MetodoCobranzaFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { error } = await supabase.from("metodos_cobranza").insert({
    nombre: formData.nombre,
    activo: formData.activo,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un método de cobranza con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/cobranzas");
}

export async function updateMetodoCobranza(id: string, formData: MetodoCobranzaFormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  if (!formData.activo) {
    const { data: sociosUsando } = await supabase
      .from("socios")
      .select("id")
      .eq("metodo_cobranza_id", id)
      .is("fecha_baja", null)
      .limit(1);

    if (sociosUsando && sociosUsando.length > 0) {
      throw new Error("No se puede desactivar un método de cobranza en uso por socios activos");
    }
  }

  const { error } = await supabase
    .from("metodos_cobranza")
    .update({
      nombre: formData.nombre,
      activo: formData.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un método de cobranza con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/socios/config/cobranzas");
}
