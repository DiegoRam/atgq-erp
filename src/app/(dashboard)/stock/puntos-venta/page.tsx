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
import { getPuntosVenta, deletePuntoVenta } from "./actions";
import { PuntoVentaForm } from "@/components/stock/PuntoVentaForm";
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
    id: "caja",
    header: "Caja asociada",
    cell: ({ row }) =>
      row.original.caja?.nombre ?? (
        <span className="text-muted-foreground">Sin caja</span>
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
    id: "item_count",
    header: "Ítems en Stock",
    cell: ({ row }) => row.original.item_count ?? 0,
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (puntoVenta: Deposito) => void;
        onDelete?: (puntoVenta: Deposito) => void;
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

export default function PuntosVentaPage() {
  const [data, setData] = useState<Deposito[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPunto, setEditingPunto] = useState<Deposito | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deposito | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getPuntosVenta();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(puntoVenta: Deposito) {
    setEditingPunto(puntoVenta);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingPunto(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingPunto(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await deletePuntoVenta(deleteTarget.id);
      if (error) {
        // El diálogo queda abierto para que se lea el motivo del bloqueo.
        toast.error(error);
        return;
      }
      toast.success("Punto de venta eliminado correctamente");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al eliminar el punto de venta",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      [p.nombre, p.descripcion, p.caja?.nombre].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Puntos de Venta"
        description="Sectores del club que venden al público. Cada uno maneja su propia existencia de stock."
      />
      <DataTable
        columns={columns}
        data={filtered}
        totalCount={filtered.length}
        page={1}
        pageSize={filtered.length || 50}
        onPageChange={() => {}}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre, descripción o caja..."
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Punto de Venta"
        meta={{ onEdit: handleEdit, onDelete: setDeleteTarget }}
      />

      <PuntoVentaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        puntoVenta={editingPunto}
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
            <AlertDialogTitle>Eliminar Punto de Venta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el punto de venta &quot;
              {deleteTarget?.nombre}&quot;? Esta acción no se puede deshacer. Si
              tiene ventas, movimientos de stock o existencias, no será posible
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
