"use client";

import { useEffect, useState } from "react";
import { ReportLayout } from "@/components/shared/ReportLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getSumarizacion, getCajasParaFiltro } from "./actions";
import type { Caja } from "@/types/tesoreria";

interface SumarizacionRow {
  categoria: string;
  tipo: string;
  cantidad: number;
  total: number;
}

export default function SumarizacionPage() {
  const [data, setData] = useState<SumarizacionRow[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cajaId, setCajaId] = useState("");

  useEffect(() => {
    getCajasParaFiltro().then(setCajas);
  }, []);

  function handleSearch() {
    setIsLoading(true);
    getSumarizacion({
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      caja_id: cajaId || undefined,
    })
      .then(setData)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReportLayout
      title="Sumarización de Conceptos"
      filters={
        <>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              className="w-36"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              className="w-36"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
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
          <Button onClick={handleSearch} size="sm" className="self-end">
            <Search className="mr-1.5 h-4 w-4" />
            Buscar
          </Button>
        </>
      }
      table={
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Sin datos para el período seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.categoria}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          d.tipo === "ingreso"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        {d.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{d.cantidad}</TableCell>
                    <TableCell className="text-right font-semibold">
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
