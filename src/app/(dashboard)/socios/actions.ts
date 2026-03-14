"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  SociosSearchParams,
  Socio,
  CategoriaCount,
  CategoriaSocial,
  MetodoCobranza,
  SocioFormData,
} from "@/types/socios";

export async function getSocios(params: SociosSearchParams) {
  const supabase = createClient();
  const { page, pageSize, search, categoria_ids, sort } = params;

  let query = supabase
    .from("socios")
    .select(
      "*, categoria:categorias_sociales(id,nombre), metodo_cobranza:metodos_cobranza(id,nombre)",
      { count: "exact" },
    );

  if (search) {
    query = query.or(
      `apellido.ilike.%${search}%,nombre.ilike.%${search}%,dni.ilike.%${search}%`,
    );
  }

  if (categoria_ids && categoria_ids.length > 0) {
    query = query.in("categoria_id", categoria_ids);
  }

  if (sort) {
    query = query.order(sort.id, { ascending: !sort.desc });
  } else {
    query = query.order("nro_socio", { ascending: true });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);

  // Fetch cuota counts for the current page's socios
  const socioIds = (data as Socio[]).map((s) => s.id);
  let cuotaCounts: Record<string, { pagas: number; impagas: number }> = {};

  if (socioIds.length > 0) {
    const { data: cuotas } = await supabase
      .from("cuotas")
      .select("socio_id, pagada")
      .in("socio_id", socioIds);

    if (cuotas) {
      cuotaCounts = cuotas.reduce(
        (acc, c) => {
          if (!acc[c.socio_id]) acc[c.socio_id] = { pagas: 0, impagas: 0 };
          if (c.pagada) acc[c.socio_id].pagas++;
          else acc[c.socio_id].impagas++;
          return acc;
        },
        {} as Record<string, { pagas: number; impagas: number }>,
      );
    }
  }

  const sociosWithCuotas = (data as Socio[]).map((s) => ({
    ...s,
    cuotas_pagas: cuotaCounts[s.id]?.pagas ?? 0,
    cuotas_impagas: cuotaCounts[s.id]?.impagas ?? 0,
  }));

  return { data: sociosWithCuotas, count: count ?? 0 };
}

export async function getCategoryCounts(): Promise<CategoriaCount[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_category_counts");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaCount[];
}

export async function getCategorias(): Promise<CategoriaSocial[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_sociales")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaSocial[];
}

export async function getMetodosCobranza(): Promise<MetodoCobranza[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("metodos_cobranza")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as MetodoCobranza[];
}

export async function getNextNroSocio(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from("socios")
    .select("nro_socio")
    .order("nro_socio", { ascending: false })
    .limit(1)
    .single();
  return data ? data.nro_socio + 1 : 1;
}

export async function checkDniUnique(
  dni: string,
  excludeId?: string,
): Promise<boolean> {
  const supabase = createClient();
  let query = supabase
    .from("socios")
    .select("id")
    .eq("dni", dni)
    .limit(1);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  const { data } = await query;
  return !data || data.length === 0;
}

export async function createSocio(formData: SocioFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("socios").insert({
    nro_socio: formData.nro_socio,
    apellido: formData.apellido,
    nombre: formData.nombre,
    dni: formData.dni,
    categoria_id: formData.categoria_id,
    fecha_alta: formData.fecha_alta,
    fecha_baja: formData.fecha_baja || null,
    metodo_cobranza_id: formData.metodo_cobranza_id || null,
    localidad: formData.localidad || null,
    fecha_nacimiento: formData.fecha_nacimiento || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/socios");
}

export async function updateSocio(id: string, formData: SocioFormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("socios")
    .update({
      nro_socio: formData.nro_socio,
      apellido: formData.apellido,
      nombre: formData.nombre,
      dni: formData.dni,
      categoria_id: formData.categoria_id,
      fecha_alta: formData.fecha_alta,
      fecha_baja: formData.fecha_baja || null,
      metodo_cobranza_id: formData.metodo_cobranza_id || null,
      localidad: formData.localidad || null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/socios");
}
