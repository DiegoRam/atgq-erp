"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ReportLayout } from "@/components/shared/ReportLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import {
  PuntoVentaFilter,
  TODOS_PDV,
  pdvFiltro,
} from "@/components/ventas/PuntoVentaFilter";
import { getVentasMensualesChart } from "./actions";
import {
  chartGrid,
  chartAxis,
  chartTooltip,
  chartCursorLine,
  chartActiveDot,
  CHART_COLORS,
} from "@/lib/chart-theme";

interface VentaMensualChart {
  mes: string;
  total: number;
}

export default function GraficoVentasPage() {
  const [data, setData] = useState<VentaMensualChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [puntoVentaId, setPuntoVentaId] = useState(TODOS_PDV);

  useEffect(() => {
    setIsLoading(true);
    getVentasMensualesChart(pdvFiltro(puntoVentaId))
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [puntoVentaId]);

  return (
    <ReportLayout
      title="Gráfico de Ventas"
      filters={
        <PuntoVentaFilter value={puntoVentaId} onChange={setPuntoVentaId} />
      }
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid {...chartGrid} />
              <XAxis
                dataKey="mes"
                {...chartAxis}
                angle={-30}
                textAnchor="end"
                height={80}
              />
              <YAxis
                {...chartAxis}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("es-AR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                {...chartTooltip}
                cursor={chartCursorLine}
                formatter={(value) => [formatCurrency(Number(value)), "Ventas"]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke={CHART_COLORS[2]}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS[2] }}
                activeDot={chartActiveDot}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : undefined
      }
      table={
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Total Ventas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 2 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                data.map((d) => (
                  <TableRow key={d.mes}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(d.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      }
    />
  );
}
