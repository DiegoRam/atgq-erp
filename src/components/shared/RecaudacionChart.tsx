"use client";

import {
  BarChart,
  Bar,
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
          formatter={(value) => [
            formatCurrency(Number(value)),
            "Recaudación neta",
          ]}
        />
        <Bar dataKey="total" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
