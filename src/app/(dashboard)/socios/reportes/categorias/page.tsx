"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
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
import { getSociosPorCategoria } from "./actions";

export default function ReportCategoriasPage() {
  const [data, setData] = useState<{ categoria: string; cantidad: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSociosPorCategoria()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const total = data
    .filter((d) => d.categoria !== "BAJA")
    .reduce((sum, d) => sum + Number(d.cantidad), 0);

  return (
    <ReportLayout
      title="Socios por Categoría"
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.filter((d) => d.categoria !== "BAJA")}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoria" fontSize={12} angle={-30} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : undefined
      }
      table={
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">%</TableHead>
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
              ) : (
                data.map((d) => (
                  <TableRow key={d.categoria}>
                    <TableCell className="font-medium">{d.categoria}</TableCell>
                    <TableCell className="text-right">{d.cantidad}</TableCell>
                    <TableCell className="text-right">
                      {d.categoria !== "BAJA" && total > 0
                        ? ((Number(d.cantidad) / total) * 100).toFixed(1) + "%"
                        : "—"}
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
