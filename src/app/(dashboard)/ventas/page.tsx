"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  formatDate,
  formatDateOnly,
  formatCurrency,
  exportToCSV,
} from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import {
  getVentas,
  getVentaDetalle,
  anularVenta,
  getPuntosVentaParaFiltro,
} from "./actions";
import type { Venta, VentaItem, VentasSearchParams } from "@/types/ventas";

const PAGE_SIZE = 50;

function clienteNombre(venta: Venta): string {
  if (venta.socio) {
    return `#${venta.socio.nro_socio} ${venta.socio.apellido}, ${venta.socio.nombre}`;
  }
  if (venta.cliente) {
    return `${venta.cliente.apellido}, ${venta.cliente.nombre}`;
  }
  if (venta.no_socio_nombre) {
    return `${venta.no_socio_nombre} (No socio)`;
  }
  return "—";
}

const columns: ColumnDef<Venta>[] = [
  {
    accessorKey: "fecha",
    header: "Fecha",
    cell: ({ row }) => formatDate(row.original.fecha),
  },
  {
    id: "nro_venta",
    header: "Nro Venta",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.id.slice(0, 8).toUpperCase()}
      </span>
    ),
  },
  {
    id: "punto_venta",
    header: "Punto de Venta",
    cell: ({ row }) => row.original.punto_venta?.nombre ?? "—",
    enableSorting: false,
  },
  {
    id: "cliente",
    header: "Cliente / Socio",
    cell: ({ row }) => clienteNombre(row.original),
    enableSorting: false,
  },
  {
    id: "items_count",
    header: "Ítems",
    cell: ({ row }) => row.original.items_count ?? 0,
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-semibold">
        {formatCurrency(Number(row.original.total))}
      </span>
    ),
  },
  {
    id: "metodo_pago",
    header: "Método Pago",
    cell: ({ row }) => row.original.metodo_pago?.nombre ?? "—",
    enableSorting: false,
  },
  {
    accessorKey: "anulada",
    header: "Estado",
    cell: ({ row }) =>
      row.original.anulada ? (
        <Badge className="border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15">
          Anulada
        </Badge>
      ) : (
        <Badge className="border-transparent bg-success/15 text-success hover:bg-success/15">
          Activa
        </Badge>
      ),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onAnular?: (v: Venta) => void;
        onExpand?: (v: Venta) => void;
      };
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onExpand?.(row.original)}
            title="Ver detalle"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          {!row.original.anulada && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => meta?.onAnular?.(row.original)}
              title="Anular"
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
];

export default function VentasRealizadasPage() {
  const [data, setData] = useState<Venta[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [estado, setEstado] = useState("");
  const [puntoVentaId, setPuntoVentaId] = useState("");
  const [puntosVenta, setPuntosVenta] = useState<
    { id: string; nombre: string }[]
  >([]);

  // Expand / Anular
  const [expandedVenta, setExpandedVenta] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<VentaItem[]>([]);
  const [anularTarget, setAnularTarget] = useState<Venta | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: VentasSearchParams = {
        page,
        pageSize: PAGE_SIZE,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        estado: estado || undefined,
        punto_venta_id:
          puntoVentaId && puntoVentaId !== "all" ? puntoVentaId : undefined,
      };
      const result = await getVentas(params);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, fechaDesde, fechaHasta, estado, puntoVentaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getPuntosVentaParaFiltro()
      .then(setPuntosVenta)
      .catch(() => setPuntosVenta([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [fechaDesde, fechaHasta, estado, puntoVentaId]);

  async function handleExpand(venta: Venta) {
    if (expandedVenta === venta.id) {
      setExpandedVenta(null);
      setExpandedItems([]);
      return;
    }
    const items = await getVentaDetalle(venta.id);
    setExpandedItems(items);
    setExpandedVenta(venta.id);
  }

  const ventaExpandida = data.find((v) => v.id === expandedVenta);

  const ventasHeaders = [
    { key: "fecha", label: "Fecha" },
    { key: "nro_venta", label: "Nro Venta" },
    { key: "punto_venta", label: "Punto de Venta" },
    { key: "cliente", label: "Cliente / Socio" },
    // La constancia de legítimo usuario sólo sirve si se puede consultar
    { key: "no_socio_dni", label: "DNI No Socio" },
    { key: "no_socio_credencial", label: "Venc. Credencial L.U." },
    { key: "total", label: "Total" },
    { key: "metodo_pago", label: "Método Pago" },
    { key: "estado", label: "Estado" },
  ];

  function getExportData() {
    return data.map((v) => ({
      fecha: formatDate(v.fecha),
      nro_venta: v.id.slice(0, 8).toUpperCase(),
      punto_venta: v.punto_venta?.nombre ?? "",
      cliente: clienteNombre(v),
      no_socio_dni: v.no_socio_dni ?? "",
      no_socio_credencial: v.no_socio_credencial_vencimiento
        ? formatDateOnly(v.no_socio_credencial_vencimiento)
        : "",
      total: v.total,
      metodo_pago: v.metodo_pago?.nombre ?? "",
      estado: v.anulada ? "Anulada" : "Activa",
    }));
  }

  function handleExportCSV() {
    exportToCSV(getExportData(), "ventas_realizadas", ventasHeaders);
  }

  function handleExportExcel() {
    exportToExcel(
      getExportData(),
      "ventas_realizadas",
      "Ventas",
      ventasHeaders,
    );
  }

  async function handleConfirmAnular() {
    if (!anularTarget) return;
    try {
      const result = await anularVenta(anularTarget.id);
      toast.success(
        result.items_restituidos > 0
          ? `Venta anulada. Se restituyeron ${result.items_restituidos} ítem(s) al stock${
              result.movimiento_fondo_id
                ? " y se registró el egreso compensatorio en caja"
                : ""
            }.`
          : "Venta anulada correctamente",
      );
      setAnularTarget(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al anular la venta",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ventas Realizadas" />

      <div className="flex flex-wrap items-end gap-3">
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
          <Label className="text-xs">Punto de Venta</Label>
          <Select value={puntoVentaId} onValueChange={setPuntoVentaId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {puntosVenta.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="anuladas">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        meta={{
          onAnular: setAnularTarget,
          onExpand: handleExpand,
        }}
      />

      {/* Expandable detail */}
      {expandedVenta && expandedItems.length > 0 && (
        <Collapsible open>
          <CollapsibleContent>
            <div className="rounded-md border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-semibold">
                Detalle de Venta #{expandedVenta.slice(0, 8).toUpperCase()}
              </h4>
              {ventaExpandida?.no_socio_nombre && (
                <p className="mb-2 text-xs text-muted-foreground">
                  No socio: {ventaExpandida.no_socio_nombre}
                  {ventaExpandida.no_socio_dni
                    ? ` — DNI ${ventaExpandida.no_socio_dni}`
                    : ""}
                  {ventaExpandida.no_socio_credencial_vencimiento
                    ? ` — Credencial L.U. vence ${formatDateOnly(
                        ventaExpandida.no_socio_credencial_vencimiento,
                      )}`
                    : ""}
                </p>
              )}
              <div className="space-y-1">
                {expandedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.item?.nombre ?? "Ítem"} x{item.cantidad}
                    </span>
                    <span>
                      {formatCurrency(Number(item.precio_unitario))} c/u ={" "}
                      <span className="font-semibold">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AlertDialog
        open={!!anularTarget}
        onOpenChange={(open) => !open && setAnularTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Venta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea anular esta venta por{" "}
              {formatCurrency(Number(anularTarget?.total ?? 0))}? Se restituirá
              el stock en el punto de venta y se compensará el ingreso en caja.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAnular}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
