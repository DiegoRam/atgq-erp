"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import {
  getMovimientos,
  getCajasParaFiltro,
  getCategoriasParaFiltro,
} from "./actions";
import type {
  MovimientoFondo,
  Caja,
  CategoriaMovimiento,
  MovimientosSearchParams,
} from "@/types/tesoreria";

const PAGE_SIZE = 50;

const columns: ColumnDef<MovimientoFondo>[] = [
  {
    accessorKey: "fecha",
    header: "Fecha",
    cell: ({ row }) => formatDate(row.original.fecha),
  },
  {
    id: "caja",
    header: "Caja",
    cell: ({ row }) => row.original.caja?.nombre ?? "—",
    enableSorting: false,
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    cell: ({ row }) => {
      const tipo = row.original.tipo;
      const colorClass =
        tipo === "ingreso"
          ? "bg-green-100 text-green-800 hover:bg-green-100"
          : tipo === "egreso"
            ? "bg-red-100 text-red-800 hover:bg-red-100"
            : "bg-blue-100 text-blue-800 hover:bg-blue-100";
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
    id: "categoria",
    header: "Categoría",
    cell: ({ row }) => row.original.categoria?.nombre ?? "—",
    enableSorting: false,
  },
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ row }) => row.original.descripcion ?? "—",
  },
  {
    accessorKey: "monto",
    header: "Monto",
    cell: ({ row }) => {
      const tipo = row.original.tipo;
      const color = tipo === "egreso" ? "text-red-600" : "text-green-700";
      const prefix = tipo === "egreso" ? "-" : "+";
      return (
        <span className={`font-semibold ${color}`}>
          {prefix} {formatCurrency(Number(row.original.monto))}
        </span>
      );
    },
  },
];

export default function MovimientosPage() {
  const searchParams = useSearchParams();
  const initialCajaId = searchParams.get("caja") ?? "";

  const [data, setData] = useState<MovimientoFondo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalEgresos, setTotalEgresos] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [cajaId, setCajaId] = useState(initialCajaId);
  const [tipo, setTipo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Filter options
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimiento[]>([]);

  useEffect(() => {
    Promise.all([getCajasParaFiltro(), getCategoriasParaFiltro()]).then(
      ([cajasData, categoriasData]) => {
        setCajas(cajasData);
        setCategorias(categoriasData);
      },
    );
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: MovimientosSearchParams = {
        page,
        pageSize: PAGE_SIZE,
        caja_id: cajaId || undefined,
        tipo: tipo || undefined,
        categoria_id: categoriaId || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      };
      const result = await getMovimientos(params);
      setData(result.data);
      setTotalCount(result.count);
      setTotalIngresos(result.totalIngresos);
      setTotalEgresos(result.totalEgresos);
    } finally {
      setIsLoading(false);
    }
  }, [page, cajaId, tipo, categoriaId, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [cajaId, tipo, categoriaId, fechaDesde, fechaHasta]);

  const movimientosHeaders = [
    { key: "fecha", label: "Fecha" },
    { key: "caja", label: "Caja" },
    { key: "tipo", label: "Tipo" },
    { key: "categoria", label: "Categoría" },
    { key: "descripcion", label: "Descripción" },
    { key: "monto", label: "Monto" },
  ];

  function getExportData() {
    return data.map((m) => ({
      fecha: formatDate(m.fecha),
      caja: m.caja?.nombre ?? "",
      tipo: m.tipo,
      categoria: m.categoria?.nombre ?? "",
      descripcion: m.descripcion ?? "",
      monto: m.monto,
    }));
  }

  function handleExportCSV() {
    exportToCSV(getExportData(), "movimientos_fondos", movimientosHeaders);
  }

  function handleExportExcel() {
    exportToExcel(
      getExportData(),
      "movimientos_fondos",
      "Movimientos",
      movimientosHeaders,
    );
  }

  const balance = totalIngresos - totalEgresos;

  return (
    <div className="space-y-4">
      <PageHeader title="Movimientos de Fondos" />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
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
          <Label className="text-xs">Categoría</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
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
      />

      {/* Totals footer */}
      <div className="flex gap-6 rounded-md border bg-muted/30 p-3 text-sm">
        <div>
          <span className="text-muted-foreground">Total Ingresos: </span>
          <span className="font-semibold text-green-700">
            {formatCurrency(totalIngresos)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Egresos: </span>
          <span className="font-semibold text-red-600">
            {formatCurrency(totalEgresos)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Balance: </span>
          <span
            className={`font-semibold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}
          >
            {formatCurrency(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}
