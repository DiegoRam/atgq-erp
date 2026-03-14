"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  MovimientoFondo,
  MovimientosSearchParams,
  Caja,
  CategoriaMovimiento,
} from "@/types/tesoreria";

export async function getMovimientos(params: MovimientosSearchParams) {
  const supabase = createClient();
  const { page, pageSize, caja_id, tipo, categoria_id, fecha_desde, fecha_hasta } =
    params;

  let query = supabase
    .from("movimientos_fondos")
    .select(
      "*, caja:cajas!caja_id(id,nombre), categoria:categorias_movimientos(id,nombre), caja_destino:cajas!caja_destino_id(id,nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false });

  if (caja_id) query = query.eq("caja_id", caja_id);
  if (tipo) query = query.eq("tipo", tipo);
  if (categoria_id) query = query.eq("categoria_id", categoria_id);
  if (fecha_desde) query = query.gte("fecha", fecha_desde);
  if (fecha_hasta) query = query.lte("fecha", `${fecha_hasta}T23:59:59`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  // Get totals for the current filter
  let totalsQuery = supabase
    .from("movimientos_fondos")
    .select("tipo, monto");

  if (caja_id) totalsQuery = totalsQuery.eq("caja_id", caja_id);
  if (tipo) totalsQuery = totalsQuery.eq("tipo", tipo);
  if (categoria_id) totalsQuery = totalsQuery.eq("categoria_id", categoria_id);
  if (fecha_desde) totalsQuery = totalsQuery.gte("fecha", fecha_desde);
  if (fecha_hasta) totalsQuery = totalsQuery.lte("fecha", `${fecha_hasta}T23:59:59`);

  const { data: totalsData } = await totalsQuery;

  let totalIngresos = 0;
  let totalEgresos = 0;
  if (totalsData) {
    for (const m of totalsData) {
      if (m.tipo === "ingreso" || m.tipo === "transferencia") {
        totalIngresos += Number(m.monto);
      } else {
        totalEgresos += Number(m.monto);
      }
    }
  }

  return {
    data: (data ?? []) as MovimientoFondo[],
    count: count ?? 0,
    totalIngresos,
    totalEgresos,
  };
}

export async function getCajasParaFiltro(): Promise<Caja[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Caja[];
}

export async function getCategoriasParaFiltro(): Promise<CategoriaMovimiento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_movimientos")
    .select("*")
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaMovimiento[];
}
