"use client";

import { useEffect, useState } from "react";
import { ReportLayout } from "@/components/shared/ReportLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  PuntoVentaFilter,
  TODOS_PDV,
  pdvFiltro,
} from "@/components/ventas/PuntoVentaFilter";
import { ItemVentaCombobox } from "@/components/ventas/ItemVentaCombobox";
import { getItemsVentasParaFiltro, getVentasPorItem } from "./actions";

interface VentaPorItemRow {
  fecha: string;
  nro_venta: string;
  cliente: string;
  punto_venta: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

type ItemOption = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

export default function ReportePorItemPage() {
  const [items, setItems] = useState<ItemOption[]>([]);
  const [data, setData] = useState<VentaPorItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [puntoVentaId, setPuntoVentaId] = useState(TODOS_PDV);

  useEffect(() => {
    getItemsVentasParaFiltro().then(setItems);
  }, []);

  function handleSearch() {
    if (!itemId) return;
    setIsLoading(true);
    getVentasPorItem({
      item_id: itemId,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      punto_venta_id: pdvFiltro(puntoVentaId),
    })
      .then(setData)
      .finally(() => setIsLoading(false));
  }

  const totalCantidad = data.reduce((s, d) => s + d.cantidad, 0);
  const totalMonto = data.reduce((s, d) => s + d.subtotal, 0);

  return (
    <ReportLayout
      title="Venta de Ítem por Período"
      filters={
        <>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="item-reporte">
              Ítem
            </Label>
            <ItemVentaCombobox
              id="item-reporte"
              items={items}
              value={itemId}
              onChange={setItemId}
              className="w-56"
              placeholder="Seleccionar ítem..."
              searchPlaceholder="Buscar ítem..."
              emptyText="Sin ítems que coincidan"
            />
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
          <PuntoVentaFilter value={puntoVentaId} onChange={setPuntoVentaId} />
          <Button
            onClick={handleSearch}
            size="sm"
            className="self-end"
            disabled={!itemId}
          >
            <Search className="mr-1.5 h-4 w-4" />
            Buscar
          </Button>
        </>
      }
      table={
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nro Venta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Punto de Venta</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {itemId
                        ? "Sin ventas para el período seleccionado."
                        : "Seleccione un ítem y presione Buscar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(d.fecha)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.nro_venta}
                      </TableCell>
                      <TableCell>{d.cliente}</TableCell>
                      <TableCell>{d.punto_venta}</TableCell>
                      <TableCell className="text-right">{d.cantidad}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(d.precio_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(d.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data.length > 0 && (
            <div className="mt-2 text-right text-sm">
              <span className="text-muted-foreground">
                Total: {totalCantidad} unidades ={" "}
              </span>
              <span className="font-semibold">{formatCurrency(totalMonto)}</span>
            </div>
          )}
        </>
      }
    />
  );
}
