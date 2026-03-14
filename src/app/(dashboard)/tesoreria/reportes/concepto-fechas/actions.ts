"use server";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaMovimiento, MovimientoFondo } from "@/types/tesoreria";

export async function getCategoriasMovimientos(): Promise<CategoriaMovimiento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_movimientos")
    .select("*")
    .eq("activa", true)
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaMovimiento[];
}

export async function getMovimientosPorConcepto(params: {
  categoria_id: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<MovimientoFondo[]> {
  const supabase = createClient();

  let query = supabase
    .from("movimientos_fondos")
    .select(
      "*, caja:cajas!caja_id(id,nombre), categoria:categorias_movimientos(id,nombre)",
    )
    .eq("categoria_id", params.categoria_id)
    .order("fecha", { ascending: false });

  if (params.fecha_desde) query = query.gte("fecha", params.fecha_desde);
  if (params.fecha_hasta)
    query = query.lte("fecha", `${params.fecha_hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoFondo[];
}
