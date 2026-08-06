"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Pencil, ArrowRightLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getCajas, deleteCaja } from "./actions";
import { CajaForm } from "@/components/tesoreria/CajaForm";
import type { Caja } from "@/types/tesoreria";

const columns: ColumnDef<Caja>[] = [
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
    id: "saldo_actual",
    header: "Saldo Actual",
    cell: ({ row }) => {
      const saldo = row.original.saldo_actual ?? 0;
      return (
        <span
          className={`font-semibold ${saldo >= 0 ? "text-success" : "text-destructive"}`}
        >
          {formatCurrency(saldo)}
        </span>
      );
    },
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
        onEdit?: (caja: Caja) => void;
        onViewMovimientos?: (caja: Caja) => void;
        onDelete?: (caja: Caja) => void;
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
            onClick={() => meta?.onViewMovimientos?.(row.original)}
            title="Ver movimientos"
          >
            <ArrowRightLeft className="h-4 w-4" />
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

export default function CajasPage() {
  const router = useRouter();
  const [data, setData] = useState<Caja[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCaja, setEditingCaja] = useState<Caja | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Caja | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCajas();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(caja: Caja) {
    setEditingCaja(caja);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingCaja(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingCaja(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  function handleViewMovimientos(caja: Caja) {
    router.push(`/tesoreria/movimientos?caja=${caja.id}`);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCaja(deleteTarget.id);
      toast.success("Caja eliminada correctamente");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      // El diálogo queda abierto para que se lea el motivo del bloqueo.
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar la caja",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) =>
      [c.nombre, c.descripcion].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PageHeader title="Cajas" />
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
        newButtonLabel="Nueva Caja"
        meta={{
          onEdit: handleEdit,
          onViewMovimientos: handleViewMovimientos,
          onDelete: setDeleteTarget,
        }}
      />

      <CajaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        caja={editingCaja}
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
            <AlertDialogTitle>Eliminar Caja</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar la caja &quot;
              {deleteTarget?.nombre}&quot;? Esta acción no se puede deshacer. Si
              la caja tiene movimientos de fondos o puntos de venta vinculados,
              no será posible eliminarla: en ese caso desactívela.
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
