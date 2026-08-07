"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { StockItemCombobox } from "@/components/stock/StockItemCombobox";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, exportToCSV } from "@/lib/format";
import {
  getMovimientosStock,
  getItemsParaFiltro,
  getDepositosParaFiltro,
} from "./actions";
import {
  TIPO_UBICACION_LABELS,
  type MovimientoStock,
  type MovimientosStockSearchParams,
  type StockItem,
  type Deposito,
} from "@/types/stock";

/**
 * Los `<Select>` de Ubicación y Tipo usan "all" como opción "sin filtro", porque
 * Radix no acepta `""` como valor. El combo de Ítem no lo necesita: entrega `null`.
 */
const sinFiltro = (v: string) => (v && v !== "all" ? v : undefined);

const PAGE_SIZE = 50;

const columns: ColumnDef<MovimientoStock>[] = [
  {
    accessorKey: "created_at",
    header: "Fecha",
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: "item",
    header: "Ítem",
    cell: ({ row }) => row.original.item?.nombre ?? "—",
    enableSorting: false,
  },
  {
    id: "deposito",
    header: "Ubicación",
    cell: ({ row }) => row.original.deposito?.nombre ?? "—",
    enableSorting: false,
  },
  {
    id: "deposito_destino",
    header: "Destino",
    cell: ({ row }) => row.original.deposito_destino?.nombre ?? "—",
    enableSorting: false,
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    cell: ({ row }) => {
      const tipo = row.original.tipo;
      const colorClass =
        tipo === "ingreso"
          ? "border-transparent bg-success/15 text-success hover:bg-success/15"
          : tipo === "egreso"
            ? "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15"
            : "border-transparent bg-info/15 text-info hover:bg-info/15";
      const label =
        tipo === "ingreso"
          ? "Ingreso"
          : tipo === "egreso"
            ? "Egreso"
            : "Transferencia";
      return <Badge className={colorClass}>{label}</Badge>;
    },
  },
  {
    accessorKey: "cantidad",
    header: "Cantidad",
    cell: ({ row }) => {
      const tipo = row.original.tipo;
      const prefix = tipo === "egreso" ? "-" : "+";
      const color = tipo === "egreso" ? "text-destructive" : "text-success";
      return (
        <span className={`font-semibold ${color}`}>
          {prefix}{row.original.cantidad}
        </span>
      );
    },
  },
  {
    accessorKey: "motivo",
    header: "Motivo",
    cell: ({ row }) => row.original.motivo ?? "—",
  },
];

export default function MovimientosStockPage() {
  const [data, setData] = useState<MovimientoStock[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [itemId, setItemId] = useState<string | null>(null);
  const [depositoId, setDepositoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Filter options
  const [items, setItems] = useState<StockItem[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);

  useEffect(() => {
    Promise.all([getItemsParaFiltro(), getDepositosParaFiltro()]).then(
      ([itemsData, depositosData]) => {
        setItems(itemsData);
        setDepositos(depositosData);
      },
    );
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: MovimientosStockSearchParams = {
        page,
        pageSize: PAGE_SIZE,
        item_id: itemId ?? undefined,
        deposito_id: sinFiltro(depositoId),
        tipo: sinFiltro(tipo),
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      };
      const result = await getMovimientosStock(params);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, itemId, depositoId, tipo, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [itemId, depositoId, tipo, fechaDesde, fechaHasta]);

  function handleExportCSV() {
    exportToCSV(
      data.map((m) => ({
        fecha: formatDate(m.created_at),
        item: m.item?.nombre ?? "",
        deposito: m.deposito?.nombre ?? "",
        deposito_destino: m.deposito_destino?.nombre ?? "",
        tipo: m.tipo,
        cantidad: m.cantidad,
        motivo: m.motivo ?? "",
      })),
      "movimientos_stock",
      [
        { key: "fecha", label: "Fecha" },
        { key: "item", label: "Ítem" },
        { key: "deposito", label: "Ubicación" },
        { key: "deposito_destino", label: "Destino" },
        { key: "tipo", label: "Tipo" },
        { key: "cantidad", label: "Cantidad" },
        { key: "motivo", label: "Motivo" },
      ],
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Movimientos de Stock" />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="filtro-item">
            Ítem
          </Label>
          <StockItemCombobox
            id="filtro-item"
            items={items}
            value={itemId}
            onChange={setItemId}
            clearLabel="Todos"
            placeholder="Todos"
            searchPlaceholder="Buscar ítem..."
            emptyText="Sin ítems que coincidan"
            className="w-52"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Ubicación</Label>
          <Select value={depositoId} onValueChange={setDepositoId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(["deposito", "punto_venta"] as const)
                .map((t) => ({
                  tipo: t,
                  opciones: depositos.filter((d) => d.tipo === t),
                }))
                .filter((g) => g.opciones.length > 0)
                .map((g) => (
                  <SelectGroup key={g.tipo}>
                    <SelectLabel>{TIPO_UBICACION_LABELS[g.tipo]}</SelectLabel>
                    {g.opciones.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ingreso">Ingreso</SelectItem>
              <SelectItem value="egreso">Egreso</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
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
      />
    </div>
  );
}
