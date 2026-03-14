"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getClientes } from "./actions";
import { ClienteForm } from "@/components/ventas/ClienteForm";
import type { Cliente } from "@/types/ventas";

const columns: ColumnDef<Cliente>[] = [
  {
    accessorKey: "apellido",
    header: "Apellido",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.apellido}</span>
    ),
  },
  {
    accessorKey: "nombre",
    header: "Nombre",
  },
  {
    accessorKey: "dni",
    header: "DNI",
    cell: ({ row }) => row.original.dni ?? "—",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "telefono",
    header: "Teléfono",
    cell: ({ row }) => row.original.telefono ?? "—",
  },
  {
    id: "cant_compras",
    header: "Cant. Compras",
    cell: ({ row }) => row.original.cant_compras ?? 0,
  },
  {
    id: "total_comprado",
    header: "Total Comprado",
    cell: ({ row }) => formatCurrency(row.original.total_comprado ?? 0),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (c: Cliente) => void;
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

export default function ClientesPage() {
  const [data, setData] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async (searchTerm?: string) => {
    setIsLoading(true);
    try {
      const result = await getClientes(searchTerm);
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearch() {
    fetchData(search || undefined);
  }

  function handleEdit(cliente: Cliente) {
    setEditingCliente(cliente);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingCliente(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingCliente(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData(search || undefined);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" />

      <div className="flex items-end gap-2">
        <Input
          placeholder="Buscar por apellido, nombre o DNI..."
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} size="sm">
          <Search className="mr-1.5 h-4 w-4" />
          Buscar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Cliente"
        meta={{ onEdit: handleEdit }}
      />

      <ClienteForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        cliente={editingCliente}
        onSaved={handleSaved}
      />
    </div>
  );
}
