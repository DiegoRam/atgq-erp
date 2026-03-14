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
import { getVentasMensualesChart } from "./actions";

interface VentaMensualChart {
  mes: string;
  total: number;
}

export default function GraficoVentasPage() {
  const [data, setData] = useState<VentaMensualChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getVentasMensualesChart()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ReportLayout
      title="Gráfico de Ventas"
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                fontSize={12}
                angle={-30}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tickFormatter={(v) =>
                  new Intl.NumberFormat("es-AR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Ventas"]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : undefined
      }
      table={
        <div className="rounded-md border">
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
