"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Cuota } from "@/types/socios";

export async function getCuotasBySocio(socioId: string): Promise<Cuota[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cuotas")
    .select("*, tipo_cuota:tipos_cuotas(id,nombre), metodo_pago:metodos_cobranza(id,nombre)")
    .eq("socio_id", socioId)
    .order("periodo", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Cuota[];
}

export async function registrarPago(
  cuotaId: string,
  payload: { monto: number; fecha_pago: string; metodo_pago_id: string },
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("cuotas")
    .update({
      pagada: true,
      monto: payload.monto,
      fecha_pago: payload.fecha_pago,
      metodo_pago_id: payload.metodo_pago_id,
    })
    .eq("id", cuotaId);
  if (error) throw new Error(error.message);
  revalidatePath("/socios");
}

export async function previewGeneracionMasiva(
  periodo: string,
  tipoCuotaId: string,
) {
  const supabase = createClient();

  // Count active socios (no fecha_baja, not BAJA category)
  const bajaCatId = await getBajaCategoryId();
  let countQuery = supabase
    .from("socios")
    .select("id", { count: "exact", head: true })
    .is("fecha_baja", null);

  if (bajaCatId) {
    countQuery = countQuery.neq("categoria_id", bajaCatId);
  }

  const { count, error } = await countQuery;
  if (error) throw new Error(error.message);

  // Get the tipo_cuota for monto
  const { data: tipo } = await supabase
    .from("tipos_cuotas")
    .select("nombre")
    .eq("id", tipoCuotaId)
    .single();

  return {
    count: count ?? 0,
    tipoCuota: tipo?.nombre ?? "",
    periodo,
  };
}

async function getBajaCategoryId(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("categorias_sociales")
    .select("id")
    .eq("nombre", "BAJA")
    .single();
  return data?.id ?? "";
}

export async function generarCuotasMasivas(
  periodo: string,
  tipoCuotaId: string,
  monto: number,
) {
  const supabase = createClient();

  const bajaCatId = await getBajaCategoryId();

  // Get all active socios
  let query = supabase
    .from("socios")
    .select("id")
    .is("fecha_baja", null);

  if (bajaCatId) {
    query = query.neq("categoria_id", bajaCatId);
  }

  const { data: socios, error: sError } = await query;
  if (sError) throw new Error(sError.message);
  if (!socios || socios.length === 0) return { count: 0 };

  // Insert cuotas for all
  const cuotas = socios.map((s) => ({
    socio_id: s.id,
    tipo_cuota_id: tipoCuotaId,
    periodo,
    monto,
    pagada: false,
  }));

  const { error } = await supabase.from("cuotas").insert(cuotas);
  if (error) throw new Error(error.message);

  revalidatePath("/socios");
  return { count: cuotas.length };
}

export async function getTiposCuotas() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tipos_cuotas")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSocioById(socioId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("socios")
    .select("id,nro_socio,apellido,nombre")
    .eq("id", socioId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
