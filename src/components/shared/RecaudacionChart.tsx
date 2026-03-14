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

interface RecaudacionChartProps {
  data: { mes: string; total: number }[];
}

export function RecaudacionChart({ data }: RecaudacionChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mes" fontSize={12} />
        <YAxis
          tickFormatter={(v) =>
            new Intl.NumberFormat("es-AR", {
              notation: "compact",
              compactDisplay: "short",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value) => [
            formatCurrency(Number(value)),
            "Recaudación neta",
          ]}
        />
        <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
