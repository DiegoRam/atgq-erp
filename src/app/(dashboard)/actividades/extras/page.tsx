"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getActividadesExtras } from "./actions";
import { ActividadExtraForm } from "@/components/actividades/ActividadExtraForm";
import { formatDate, formatCurrency } from "@/lib/format";
import type { ActividadExtra } from "@/types/actividades";

const columns: ColumnDef<ActividadExtra>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.nombre}</span>
    ),
  },
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ row }) => row.original.descripcion ?? "—",
  },
  {
    accessorKey: "fecha",
    header: "Fecha",
    cell: ({ row }) => formatDate(row.original.fecha),
  },
  {
    accessorKey: "monto",
    header: "Monto",
    cell: ({ row }) => formatCurrency(row.original.monto),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (extra: ActividadExtra) => void;
      };
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => meta?.onEdit?.(row.original)}
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      );
    },
    enableSorting: false,
  },
];

export default function ActividadesExtrasPage() {
  const [data, setData] = useState<ActividadExtra[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ActividadExtra | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getActividadesExtras();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(extra: ActividadExtra) {
    setEditingExtra(extra);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingExtra(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingExtra(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Actividades Extras" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nueva Actividad Extra"
        meta={{ onEdit: handleEdit }}
      />

      <ActividadExtraForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        extra={editingExtra}
        onSaved={handleSaved}
      />
    </div>
  );
}
