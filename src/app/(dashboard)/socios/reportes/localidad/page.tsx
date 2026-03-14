"use client";

import { useEffect, useState } from "react";
import { ReportLayout } from "@/components/shared/ReportLayout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCSV } from "@/lib/format";
import { getSociosPorLocalidad } from "./actions";

export default function ReportLocalidadPage() {
  const [data, setData] = useState<{ localidad: string; cantidad: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSociosPorLocalidad()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  function handleExportCSV() {
    exportToCSV(
      data as unknown as Record<string, unknown>[],
      "socios_por_localidad",
      [
        { key: "localidad", label: "Localidad" },
        { key: "cantidad", label: "Cantidad" },
      ],
    );
  }

  return (
    <ReportLayout
      title="Socios por Localidad"
      actions={
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="mr-1.5 h-4 w-4" />
          CSV
        </Button>
      }
      table={
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Localidad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center">
                    Sin datos.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((d) => (
                  <TableRow key={d.localidad}>
                    <TableCell className="font-medium">{d.localidad}</TableCell>
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
