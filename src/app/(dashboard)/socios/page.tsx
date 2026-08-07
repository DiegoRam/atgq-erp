"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { FacetFilter } from "@/components/shared/FacetFilter";
import { PageHeader } from "@/components/shared/PageHeader";
import { getSocios, getCategoryCounts, getEstadoCounts } from "./actions";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatAntiguedad, exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { cn } from "@/lib/utils";
import type {
  Socio,
  CategoriaCount,
  EstadoCount,
  EstadoSocio,
  SociosSearchParams,
} from "@/types/socios";
import { SocioForm } from "@/components/socios/SocioForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";

const PAGE_SIZE = 50;

const columns: ColumnDef<Socio>[] = [
  {
    accessorKey: "nro_socio",
    header: "Nro Socio",
    cell: ({ row, table }) => {
      const meta = table.options.meta as { onEdit?: (socio: Socio) => void };
      return (
        <button
          className="font-medium text-info hover:underline"
          onClick={() => meta?.onEdit?.(row.original)}
        >
          {row.original.nro_socio}
        </button>
      );
    },
  },
  { accessorKey: "apellido", header: "Apellido" },
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "dni", header: "DNI" },
  {
    accessorKey: "categoria.nombre",
    header: "Categoría",
    id: "categoria",
    cell: ({ row }) => row.original.categoria?.nombre ?? "—",
  },
  {
    accessorKey: "fecha_alta",
    header: "Fecha Alta",
    cell: ({ row }) => formatDate(row.original.fecha_alta),
  },
  {
    id: "antiguedad",
    header: "Antigüedad",
    cell: ({ row }) => formatAntiguedad(row.original.fecha_alta),
    enableSorting: false,
  },
  {
    accessorKey: "fecha_baja",
    header: "Fecha Baja",
    cell: ({ row }) => formatDate(row.original.fecha_baja),
  },
  {
    accessorKey: "cuotas_pagas",
    header: "Pagas",
    cell: ({ row }) => row.original.cuotas_pagas ?? 0,
  },
  {
    accessorKey: "cuotas_impagas",
    header: "Impagas",
    cell: ({ row }) => {
      const v = row.original.cuotas_impagas ?? 0;
      return v > 0 ? <span className="font-semibold text-destructive">{v}</span> : 0;
    },
  },
  {
    id: "cobranza",
    header: "Cobranza",
    cell: ({ row }) => row.original.metodo_cobranza?.nombre ?? "—",
    enableSorting: false,
  },
];

const ESTADOS: { value: EstadoSocio; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "bajas", label: "Bajas" },
];

function EstadoFilter({
  value,
  counts,
  onChange,
}: {
  value: EstadoSocio;
  counts: EstadoCount[];
  onChange: (v: EstadoSocio) => void;
}) {
  const activos = Number(counts.find((c) => c.estado === "activos")?.count ?? 0);
  const bajas = Number(counts.find((c) => c.estado === "bajas")?.count ?? 0);
  const totales: Record<EstadoSocio, number> = {
    todos: activos + bajas,
    activos,
    bajas,
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Estado</h4>
      <div className="space-y-1">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => onChange(e.value)}
            aria-pressed={value === e.value}
            className={cn(
              "flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-muted",
              value === e.value && "bg-muted font-medium",
            )}
          >
            <span className="flex-1 truncate">{e.label}</span>
            <span className="text-xs text-muted-foreground">
              {counts.length > 0 ? totales[e.value] : "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SociosPage() {
  return (
    <Suspense fallback={null}>
      <SociosPageContent />
    </Suspense>
  );
}

function SociosPageContent() {
  const searchParams = useSearchParams();
  const estadoParam = searchParams.get("estado");
  const [estado, setEstado] = useState<EstadoSocio>(
    estadoParam === "activos" || estadoParam === "bajas"
      ? estadoParam
      : "todos",
  );
  const [estadoCounts, setEstadoCounts] = useState<EstadoCount[]>([]);
  const [data, setData] = useState<Socio[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [categoryCounts, setCategoryCounts] = useState<CategoriaCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null);

  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: SociosSearchParams = {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoria_ids:
          selectedCategorias.length > 0 ? selectedCategorias : undefined,
        estado,
        sort: sorting.length > 0
          ? { id: sorting[0].id, desc: sorting[0].desc }
          : null,
      };
      const result = await getSocios(params);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, selectedCategorias, estado, sorting]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategoryCounts().then(setCategoryCounts);
    getEstadoCounts().then(setEstadoCounts);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategorias, estado]);

  function handleEdit(socio: Socio) {
    setEditingSocio(socio);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingSocio(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingSocio(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
    getCategoryCounts().then(setCategoryCounts);
    getEstadoCounts().then(setEstadoCounts);
  }

  const exportHeaders = [
    { key: "nro_socio", label: "Nro Socio" },
    { key: "apellido", label: "Apellido" },
    { key: "nombre", label: "Nombre" },
    { key: "dni", label: "DNI" },
    { key: "categoria", label: "Categoría" },
    { key: "fecha_alta", label: "Fecha Alta" },
    { key: "cuotas_pagas", label: "Pagas" },
    { key: "cuotas_impagas", label: "Impagas" },
    { key: "cobranza", label: "Cobranza" },
  ];

  function getExportData() {
    return data.map((s) => ({
      nro_socio: s.nro_socio,
      apellido: s.apellido,
      nombre: s.nombre,
      dni: s.dni,
      categoria: s.categoria?.nombre ?? "",
      fecha_alta: s.fecha_alta,
      cuotas_pagas: s.cuotas_pagas ?? 0,
      cuotas_impagas: s.cuotas_impagas ?? 0,
      cobranza: s.metodo_cobranza?.nombre ?? "",
    }));
  }

  function handleExportCSV() {
    exportToCSV(getExportData(), "socios", exportHeaders);
  }

  function handleExportExcel() {
    exportToExcel(getExportData(), "socios", "Socios", exportHeaders);
  }

  const tableColumns = columns.map((col) => col);

  return (
    <div className="space-y-4">
      <PageHeader title="Administración de Socios" />
      {/* Mobile filter button */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-4 w-4" />
              Filtros
              {selectedCategorias.length + (estado !== "todos" ? 1 : 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {selectedCategorias.length + (estado !== "todos" ? 1 : 0)}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SheetHeader>
              <SheetTitle className="text-left">Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <EstadoFilter
                value={estado}
                counts={estadoCounts}
                onChange={setEstado}
              />
              <FacetFilter
                title="Categoría"
                options={categoryCounts.map((c) => ({
                  value: c.categoria_id,
                  label: c.nombre,
                  count: Number(c.count),
                }))}
                selected={selectedCategorias}
                onSelect={setSelectedCategorias}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-4">
        {/* Desktop sidebar filter */}
        <div className="hidden w-60 shrink-0 space-y-4 md:block">
          <EstadoFilter
            value={estado}
            counts={estadoCounts}
            onChange={setEstado}
          />
          <FacetFilter
            title="Categoría"
            options={categoryCounts.map((c) => ({
              value: c.categoria_id,
              label: c.nombre,
              count: Number(c.count),
            }))}
            selected={selectedCategorias}
            onSelect={setSelectedCategorias}
          />
        </div>
        <div className="min-w-0 flex-1">
          <DataTable
            columns={tableColumns}
            data={data}
            totalCount={totalCount}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onSearch={setSearch}
            onSort={setSorting}
            isLoading={isLoading}
            onNewClick={handleNew}
            newButtonLabel="Nuevo Socio"
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            searchPlaceholder="Buscar por apellido, nombre o DNI..."
            meta={{ onEdit: handleEdit }}
          />
        </div>
      </div>

      <SocioForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        socio={editingSocio}
        onSaved={handleSaved}
      />
    </div>
  );
}
