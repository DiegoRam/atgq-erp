"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { FacetFilter } from "@/components/shared/FacetFilter";
import { PageHeader } from "@/components/shared/PageHeader";
import { getSocios, getCategoryCounts } from "./actions";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatAntiguedad } from "@/lib/format";
import type { Socio, CategoriaCount, SociosSearchParams } from "@/types/socios";
import { SocioForm } from "@/components/socios/SocioForm";

const PAGE_SIZE = 50;

const columns: ColumnDef<Socio>[] = [
  {
    accessorKey: "nro_socio",
    header: "Nro Socio",
    cell: ({ row, table }) => {
      const meta = table.options.meta as { onEdit?: (socio: Socio) => void };
      return (
        <button
          className="font-medium text-blue-600 hover:underline"
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
      return v > 0 ? <span className="font-semibold text-red-600">{v}</span> : 0;
    },
  },
  {
    id: "cobranza",
    header: "Cobranza",
    cell: ({ row }) => row.original.metodo_cobranza?.nombre ?? "—",
    enableSorting: false,
  },
];

export default function SociosPage() {
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
  }, [page, debouncedSearch, selectedCategorias, sorting]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategoryCounts().then(setCategoryCounts);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategorias]);

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
  }

  const tableColumns = columns.map((col) => col);

  return (
    <div className="space-y-4">
      <PageHeader title="Administración de Socios" />
      <div className="flex gap-4">
        <div className="w-60 shrink-0">
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
