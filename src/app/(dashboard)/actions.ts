"use server";

import { createClient } from "@/lib/supabase/server";

interface DashboardData {
  sociosActivos: number;
  cuotasImpagas: number;
  recaudacionMes: number;
  ventasMes: number;
  stockCritico: number;
  recaudacion6Meses: { mes: string; total: number }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const now = new Date();
  const mesActualStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesActualEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    sociosRes,
    cuotasRes,
    ingresosRes,
    egresosRes,
    ventasRes,
    stockRes,
  ] = await Promise.all([
    // 1. Socios activos
    supabase
      .from("socios")
      .select("id", { count: "exact", head: true })
      .is("fecha_baja", null),

    // 2. Cuotas impagas del mes
    supabase
      .from("cuotas")
      .select("id", { count: "exact", head: true })
      .eq("pagada", false)
      .eq("periodo", periodoActual),

    // 3. Ingresos del mes
    supabase
      .from("movimientos_fondos")
      .select("monto")
      .eq("tipo", "ingreso")
      .gte("fecha", mesActualStart.toISOString())
      .lte("fecha", mesActualEnd.toISOString()),

    // 3b. Egresos del mes
    supabase
      .from("movimientos_fondos")
      .select("monto")
      .eq("tipo", "egreso")
      .gte("fecha", mesActualStart.toISOString())
      .lte("fecha", mesActualEnd.toISOString()),

    // 4. Ventas del mes
    supabase
      .from("ventas")
      .select("total")
      .eq("anulada", false)
      .gte("fecha", mesActualStart.toISOString())
      .lte("fecha", mesActualEnd.toISOString()),

    // 5. Stock crítico
    supabase
      .from("stock_inventario")
      .select("id", { count: "exact", head: true })
      .lte("cantidad", 0),
  ]);

  const totalIngresos = (ingresosRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.monto),
    0,
  );
  const totalEgresos = (egresosRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.monto),
    0,
  );
  const totalVentas = (ventasRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.total),
    0,
  );

  // 6. Recaudación últimos 6 meses
  const meses: { mes: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const mesLabel = d.toLocaleDateString("es-AR", {
      month: "short",
      year: "2-digit",
    });
    meses.push({ mes: mesLabel, start: d, end });
  }

  const { data: movimientos6m } = await supabase
    .from("movimientos_fondos")
    .select("tipo, monto, fecha")
    .gte("fecha", meses[0].start.toISOString())
    .lte("fecha", meses[meses.length - 1].end.toISOString());

  const recaudacion6Meses = meses.map(({ mes, start, end }) => {
    let total = 0;
    for (const m of movimientos6m ?? []) {
      const fecha = new Date(m.fecha);
      if (fecha >= start && fecha <= end) {
        total += m.tipo === "ingreso" ? Number(m.monto) : -Number(m.monto);
      }
    }
    return { mes, total };
  });

  return {
    sociosActivos: sociosRes.count ?? 0,
    cuotasImpagas: cuotasRes.count ?? 0,
    recaudacionMes: totalIngresos - totalEgresos,
    ventasMes: totalVentas,
    stockCritico: stockRes.count ?? 0,
    recaudacion6Meses,
  };
}
