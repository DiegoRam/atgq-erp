"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getCuotasMensuales } from "./actions";
import {
  chartGrid,
  chartAxis,
  chartTooltip,
  chartCursorLine,
  chartActiveDot,
  CHART_COLORS,
} from "@/lib/chart-theme";

export default function ReportCuotasMensualesPage() {
  const currentYear = new Date().getFullYear();
  const [fechaDesde, setFechaDesde] = useState(`${currentYear}-01-01`);
  const [fechaHasta, setFechaHasta] = useState(`${currentYear}-12-31`);
  const [data, setData] = useState<{ mes: string; cuotas_pagadas: number; monto: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch() {
    setIsLoading(true);
    try {
      const result = await getCuotasMensuales(fechaDesde, fechaHasta);
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ReportLayout
      title="Cuotas Cobradas Mensualmente"
      filters={
        <>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleSearch} size="sm" className="self-end">
            Buscar
          </Button>
        </>
      }
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="mes" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...chartTooltip} cursor={chartCursorLine} />
              <Line
                type="monotone"
                dataKey="monto"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
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
                <TableHead className="text-right">Cuotas Pagadas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    {isLoading ? "" : "Use los filtros y presione Buscar."}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((d) => (
                  <TableRow key={d.mes}>
                    <TableCell className="font-medium">{d.mes}</TableCell>
                    <TableCell className="text-right">{d.cuotas_pagadas}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(d.monto))}</TableCell>
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
