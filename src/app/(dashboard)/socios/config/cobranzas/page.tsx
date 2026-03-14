"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getMetodosCobranza } from "./actions";
import { MetodoCobranzaForm } from "@/components/socios/MetodoCobranzaForm";
import type { MetodoCobranza } from "@/types/socios";

const columns: ColumnDef<MetodoCobranza>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.nombre}</span>
    ),
  },
  {
    accessorKey: "activo",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.activo ? "default" : "secondary"}>
        {row.original.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (metodo: MetodoCobranza) => void;
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

export default function CobranzasPage() {
  const [data, setData] = useState<MetodoCobranza[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMetodo, setEditingMetodo] = useState<MetodoCobranza | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getMetodosCobranza();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(metodo: MetodoCobranza) {
    setEditingMetodo(metodo);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingMetodo(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingMetodo(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Métodos de Cobranza" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Método"
        meta={{ onEdit: handleEdit }}
      />

      <MetodoCobranzaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        metodo={editingMetodo}
        onSaved={handleSaved}
      />
    </div>
  );
}
