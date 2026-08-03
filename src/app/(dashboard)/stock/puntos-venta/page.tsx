"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { getPuntosVenta } from "./actions";
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

export default function PuntosVentaPage() {
  const [data, setData] = useState<Deposito[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPunto, setEditingPunto] = useState<Deposito | null>(null);

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
        meta={{ onEdit: handleEdit }}
      />

      <PuntoVentaForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        puntoVenta={editingPunto}
        onSaved={handleSaved}
      />
    </div>
  );
}
