"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getTiposCuotas } from "./actions";
import { TipoCuotaForm } from "@/components/socios/TipoCuotaForm";
import type { TipoCuota } from "@/types/socios";

const columns: ColumnDef<TipoCuota>[] = [
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
    accessorKey: "afecta_padron",
    header: "Afecta padrón",
    cell: ({ row }) => (
      <Badge variant={row.original.afecta_padron ? "default" : "secondary"}>
        {row.original.afecta_padron ? "Sí" : "No"}
      </Badge>
    ),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (tipo: TipoCuota) => void;
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

export default function TipoCuotasPage() {
  const [data, setData] = useState<TipoCuota[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoCuota | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getTiposCuotas();
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(tipo: TipoCuota) {
    setEditingTipo(tipo);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingTipo(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingTipo(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((t) =>
      [t.nombre, t.descripcion].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PageHeader title="Tipo de Cuotas" />
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
        newButtonLabel="Nuevo Tipo"
        meta={{ onEdit: handleEdit }}
      />

      <TipoCuotaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        tipoCuota={editingTipo}
        onSaved={handleSaved}
      />
    </div>
  );
}
