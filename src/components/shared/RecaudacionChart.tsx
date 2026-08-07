"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import {
  chartGrid,
  chartAxis,
  chartTooltip,
  chartCursorBar,
  CHART_COLORS,
} from "@/lib/chart-theme";

interface RecaudacionChartProps {
  data: { mes: string; total: number }[];
}

export function RecaudacionChart({ data }: RecaudacionChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid {...chartGrid} />
        <XAxis dataKey="mes" {...chartAxis} />
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
          cursor={chartCursorBar}
          formatter={(value) => [formatCurrency(Number(value)), "Resultado neto"]}
        />
        {/* Un mes con egresos > ingresos es una pérdida: pintarlo del mismo
            verde que un superávit hacía que la barra bajo cero se leyera como
            un resultado positivo más. */}
        <Bar dataKey="total" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.mes}
              fill={d.total < 0 ? "hsl(var(--destructive))" : CHART_COLORS[1]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
