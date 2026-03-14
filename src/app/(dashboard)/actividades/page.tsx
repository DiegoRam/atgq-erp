"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Eye } from "lucide-react";
import Link from "next/link";
import { getActividades } from "./actions";
import { ActividadForm } from "@/components/actividades/ActividadForm";
import { formatCurrency } from "@/lib/format";
import type { Actividad } from "@/types/actividades";

const columns: ColumnDef<Actividad>[] = [
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
    accessorKey: "monto_cuota",
    header: "Monto Cuota",
    cell: ({ row }) => formatCurrency(row.original.monto_cuota),
  },
  {
    id: "inscriptos_count",
    header: "Inscriptos",
    cell: ({ row }) => row.original.inscriptos_count ?? 0,
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
        onEdit?: (actividad: Actividad) => void;
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
          <Button variant="ghost" size="sm" asChild title="Ver detalle">
            <Link href={`/actividades/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    },
    enableSorting: false,
  },
];

export default function ActividadesPage() {
  const [data, setData] = useState<Actividad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getActividades();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(actividad: Actividad) {
    setEditingActividad(actividad);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingActividad(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingActividad(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Administración de Actividades" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nueva Actividad"
        meta={{ onEdit: handleEdit }}
      />

      <ActividadForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        actividad={editingActividad}
        onSaved={handleSaved}
      />
    </div>
  );
}
