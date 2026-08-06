"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getItemsVentas, deleteItemVenta } from "./actions";
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
        onDelete?: (item: ItemVenta) => void;
      };
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onEdit?.(row.original)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onDelete?.(row.original)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
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
  const [deleteTarget, setDeleteTarget] = useState<ItemVenta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteItemVenta(deleteTarget.id);
      toast.success("Ítem eliminado correctamente");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      // El diálogo queda abierto para que se lea el motivo del bloqueo.
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el ítem",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((i) =>
      [i.nombre, i.descripcion, i.stock_item?.nombre].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PageHeader title="Ítems de Ventas" />
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={filtered.length}
        page={1}
        pageSize={filtered.length || 50}
        onPageChange={() => {}}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre, descripción o stock..."
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Ítem"
        meta={{ onEdit: handleEdit, onDelete: setDeleteTarget }}
      />

      <ItemVentaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        item={editingItem}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent
          onEscapeKeyDown={(e) => {
            if (isDeleting) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Ítem de Venta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el ítem &quot;
              {deleteTarget?.nombre}&quot;? Esta acción no se puede deshacer. Si
              el ítem ya figura en ventas registradas, no será posible
              eliminarlo: en ese caso desactívelo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
