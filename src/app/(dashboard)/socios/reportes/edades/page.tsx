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
import { getSociosPorEdad } from "./actions";

export default function ReportEdadesPage() {
  const [data, setData] = useState<{ rango: string; cantidad: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSociosPorEdad()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ReportLayout
      title="Socios por Edades"
      chart={
        data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rango" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        ) : undefined
      }
      table={
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rango de Edad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : (
                data.map((d) => (
                  <TableRow key={d.rango}>
                    <TableCell className="font-medium">{d.rango}</TableCell>
                    <TableCell className="text-right">{d.cantidad}</TableCell>
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
