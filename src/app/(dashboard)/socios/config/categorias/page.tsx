"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getCategoriasSociales } from "./actions";
import { CategoriaSocialForm } from "@/components/socios/CategoriaSocialForm";
import type { CategoriaSocial } from "@/types/socios";

const columns: ColumnDef<CategoriaSocial>[] = [
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
    accessorKey: "monto_base",
    header: "Monto Base",
    cell: ({ row }) =>
      row.original.monto_base != null
        ? formatCurrency(row.original.monto_base)
        : "—",
  },
  {
    accessorKey: "activa",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.activa ? "default" : "secondary"}>
        {row.original.activa ? "Activa" : "Inactiva"}
      </Badge>
    ),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (cat: CategoriaSocial) => void;
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

export default function CategoriasPage() {
  const [data, setData] = useState<CategoriaSocial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] =
    useState<CategoriaSocial | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCategoriasSociales();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(cat: CategoriaSocial) {
    setEditingCategoria(cat);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingCategoria(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingCategoria(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Categorías Sociales" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nueva Categoría"
        meta={{ onEdit: handleEdit }}
      />

      <CategoriaSocialForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        categoria={editingCategoria}
        onSaved={handleSaved}
      />
    </div>
  );
}
