"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getCategorias } from "./actions";
import { CategoriaMovimientoForm } from "@/components/tesoreria/CategoriaMovimientoForm";
import type { CategoriaMovimiento } from "@/types/tesoreria";

const columns: ColumnDef<CategoriaMovimiento>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.nombre}</span>
    ),
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    cell: ({ row }) => (
      <Badge
        className={
          row.original.tipo === "ingreso"
            ? "bg-green-100 text-green-800 hover:bg-green-100"
            : "bg-red-100 text-red-800 hover:bg-red-100"
        }
      >
        {row.original.tipo === "ingreso" ? "Ingreso" : "Egreso"}
      </Badge>
    ),
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
        onEdit?: (cat: CategoriaMovimiento) => void;
      };
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => meta?.onEdit?.(row.original)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      );
    },
    enableSorting: false,
  },
];

export default function CategoriasMovimientosPage() {
  const [data, setData] = useState<CategoriaMovimiento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] =
    useState<CategoriaMovimiento | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCategorias();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(cat: CategoriaMovimiento) {
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
      <PageHeader title="Categorías de Movimientos" />
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

      <CategoriaMovimientoForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        categoria={editingCategoria}
        onSaved={handleSaved}
      />
    </div>
  );
}
