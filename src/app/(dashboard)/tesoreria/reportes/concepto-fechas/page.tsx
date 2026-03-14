"use client";

import { useEffect, useState } from "react";
import { ReportLayout } from "@/components/shared/ReportLayout";
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
import { formatDate, formatCurrency } from "@/lib/format";
import { getCategoriasMovimientos, getMovimientosPorConcepto } from "./actions";
import type { CategoriaMovimiento, MovimientoFondo } from "@/types/tesoreria";

export default function ConceptoFechasPage() {
  const [categorias, setCategorias] = useState<CategoriaMovimiento[]>([]);
  const [data, setData] = useState<MovimientoFondo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    getCategoriasMovimientos().then(setCategorias);
  }, []);

  function handleSearch() {
    if (!categoriaId) return;
    setIsLoading(true);
    getMovimientosPorConcepto({
      categoria_id: categoriaId,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    })
      .then(setData)
      .finally(() => setIsLoading(false));
  }

  const total = data.reduce((sum, m) => sum + Number(m.monto), 0);

  return (
    <ReportLayout
      title="Concepto entre Fechas"
      filters={
        <>
          <div className="space-y-1">
            <Label className="text-xs">Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} ({c.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <Button
            onClick={handleSearch}
            size="sm"
            className="self-end"
            disabled={!categoriaId}
          >
            <Search className="mr-1.5 h-4 w-4" />
            Buscar
          </Button>
        </>
      }
      table={
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
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
                      {categoriaId
                        ? "Sin movimientos para el período seleccionado."
                        : "Seleccione una categoría y presione Buscar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.fecha)}</TableCell>
                      <TableCell>{m.caja?.nombre ?? "—"}</TableCell>
                      <TableCell>{m.descripcion ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(m.monto))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data.length > 0 && (
            <div className="mt-2 text-right text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold">{formatCurrency(total)}</span>
              <span className="ml-4 text-muted-foreground">
                ({data.length} movimientos)
              </span>
            </div>
          )}
        </>
      }
    />
  );
}
