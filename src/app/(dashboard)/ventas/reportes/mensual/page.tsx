"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { ReportLayout } from "@/components/shared/ReportLayout";
import { exportToExcel } from "@/lib/export";
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
  TableFooter,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { getVentasMensuales } from "./actions";

interface VentaMensualRow {
  mes: string;
  cantidad: number;
  total: number;
  promedio: number;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function ReporteMensualPage() {
  const [data, setData] = useState<VentaMensualRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [anio, setAnio] = useState(String(currentYear));

  useEffect(() => {
    setIsLoading(true);
    getVentasMensuales(parseInt(anio))
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [anio]);

  const totalVentas = data.reduce((s, d) => s + d.cantidad, 0);
  const totalMonto = data.reduce((s, d) => s + d.total, 0);

  function handleExportExcel() {
    exportToExcel(
      data.filter((d) => d.cantidad > 0).map((d) => ({
        mes: d.mes,
        cantidad: d.cantidad,
        total: d.total,
        promedio: d.promedio,
      })),
      `ventas_mensual_${anio}`,
      "Ventas Mensual",
      [
        { key: "mes", label: "Mes" },
        { key: "cantidad", label: "Cantidad" },
        { key: "total", label: "Total" },
        { key: "promedio", label: "Promedio" },
      ],
    );
  }

  return (
    <ReportLayout
      title="Ventas Sumarizadas Mensual"
      actions={
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Excel
        </Button>
      }
      filters={
        <div className="space-y-1">
          <Label className="text-xs">Año</Label>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      table={
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                data
                  .filter((d) => d.cantidad > 0)
                  .map((d) => (
                    <TableRow key={d.mes}>
                      <TableCell className="font-medium">{d.mes}</TableCell>
                      <TableCell className="text-right">{d.cantidad}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(d.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(d.promedio)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
            {!isLoading && totalVentas > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">
                    {totalVentas}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalMonto)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalVentas > 0 ? totalMonto / totalVentas : 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      }
    />
  );
}
