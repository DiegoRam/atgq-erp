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
import { getDepositos, deleteDeposito } from "./actions";
import { DepositoForm } from "@/components/stock/DepositoForm";
import type { Deposito } from "@/types/stock";

const columns: ColumnDef<Deposito>[] = [
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
    accessorKey: "activo",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.activo ? "default" : "secondary"}>
        {row.original.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
  {
    id: "item_count",
    header: "Ítems en Stock",
    cell: ({ row }) => row.original.item_count ?? 0,
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (deposito: Deposito) => void;
        onDelete?: (deposito: Deposito) => void;
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

export default function DepositosPage() {
  const [data, setData] = useState<Deposito[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeposito, setEditingDeposito] = useState<Deposito | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deposito | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDepositos();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(deposito: Deposito) {
    setEditingDeposito(deposito);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingDeposito(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingDeposito(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDeposito(deleteTarget.id);
      toast.success("Depósito eliminado correctamente");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      // El diálogo queda abierto para que se lea el motivo del bloqueo.
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el depósito",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d) =>
      [d.nombre, d.descripcion].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PageHeader title="Depósitos" />
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={filtered.length}
        page={1}
        pageSize={filtered.length || 50}
        onPageChange={() => {}}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre o descripción..."
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Depósito"
        meta={{ onEdit: handleEdit, onDelete: setDeleteTarget }}
      />

      <DepositoForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        deposito={editingDeposito}
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
            <AlertDialogTitle>Eliminar Depósito</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el depósito &quot;
              {deleteTarget?.nombre}&quot;? Esta acción no se puede deshacer. Si
              el depósito tiene movimientos de stock o existencias, no será
              posible eliminarlo: en ese caso desactívelo.
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
