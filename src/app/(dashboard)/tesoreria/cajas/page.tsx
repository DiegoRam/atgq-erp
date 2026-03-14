"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getCajas } from "./actions";
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
          className={`font-semibold ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}
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

  return (
    <div className="space-y-4">
      <PageHeader title="Cajas" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nueva Caja"
        meta={{ onEdit: handleEdit, onViewMovimientos: handleViewMovimientos }}
      />

      <CajaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        caja={editingCaja}
        onSaved={handleSaved}
      />
    </div>
  );
}
