"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getItemsVentas } from "./actions";
import { ItemVentaForm } from "@/components/ventas/ItemVentaForm";
import type { ItemVenta } from "@/types/ventas";

const columns: ColumnDef<ItemVenta>[] = [
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
    accessorKey: "precio",
    header: "Precio",
    cell: ({ row }) => formatCurrency(Number(row.original.precio)),
  },
  {
    id: "stock_item",
    header: "Stock vinculado",
    cell: ({ row }) => row.original.stock_item?.nombre ?? "—",
    enableSorting: false,
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
        onEdit?: (item: ItemVenta) => void;
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

export default function ItemsVentasPage() {
  const [data, setData] = useState<ItemVenta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemVenta | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getItemsVentas();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(item: ItemVenta) {
    setEditingItem(item);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingItem(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ítems de Ventas" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Ítem"
        meta={{ onEdit: handleEdit }}
      />

      <ItemVentaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        item={editingItem}
        onSaved={handleSaved}
      />
    </div>
  );
}
