"use server";

import { createClient } from "@/lib/supabase/server";

interface DashboardData {
  sociosActivos: number;
  sociosTotal: number;
  sociosMorosos: number;
  resultadoNetoMes: number;
  ventasMes: number;
  itemsSinStock: number;
  recaudacion6Meses: { mes: string; total: number }[];
}

interface DashboardMetricsRow {
  socios_activos: number;
  socios_total: number;
  socios_morosos: number;
  resultado_neto_mes: number | string;
  ventas_mes: number | string;
  items_sin_stock: number;
  serie_6_meses: { mes: string; total: number | string }[];
}

/** "2026-03" → "mar 26" */
function formatMesLabel(mes: string): string {
  const [year, month] = mes.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });
}

/**
 * Todas las métricas se agregan en SQL (`get_dashboard_metrics`). No traer filas
 * y sumar en JS: PostgREST corta en `max_rows` (1000) y las sumas quedan
 * subestimadas en silencio. Las ventanas de mes también se calculan en la DB,
 * en America/Argentina/Buenos_Aires, para no depender del TZ del servidor.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_metrics").single();

  if (error) throw new Error(error.message);

  const m = data as DashboardMetricsRow;

  return {
    sociosActivos: Number(m.socios_activos),
    sociosTotal: Number(m.socios_total),
    sociosMorosos: Number(m.socios_morosos),
    resultadoNetoMes: Number(m.resultado_neto_mes),
    ventasMes: Number(m.ventas_mes),
    itemsSinStock: Number(m.items_sin_stock),
    recaudacion6Meses: (m.serie_6_meses ?? []).map((r) => ({
      mes: formatMesLabel(r.mes),
      total: Number(r.total),
    })),
  };
}
