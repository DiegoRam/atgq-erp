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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getIngresosMensuales, getCajasParaFiltro } from "./actions";
import type { Caja } from "@/types/tesoreria";

interface IngresoMensual {
  mes: string;
  total: number;
}

export default function GraficoMovimientosPage() {
  const [data, setData] = useState<IngresoMensual[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCajasParaFiltro().then(setCajas);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    getIngresosMensuales({ caja_id: cajaId || undefined })
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [cajaId]);

  return (
    <ReportLayout
      title="Gráfico de Movimientos (Ingresos)"
      filters={
        <div className="space-y-1">
          <Label className="text-xs">Caja</Label>
          <Select value={cajaId} onValueChange={setCajaId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cajas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" fontSize={12} angle={-30} textAnchor="end" height={80} />
              <YAxis
                tickFormatter={(v) =>
                  new Intl.NumberFormat("es-AR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Ingresos"]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: "#22c55e" }}
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
                <TableHead className="text-right">Total Ingresos</TableHead>
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
