"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getRolesWithCount, deleteRole } from "./actions";
import { RolForm } from "@/components/security/RolForm";
import type { RoleWithCount } from "@/types/security";

const columns: ColumnDef<RoleWithCount>[] = [
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
    accessorKey: "usuarios_count",
    header: "Usuarios",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.usuarios_count}</Badge>
    ),
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (r: RoleWithCount) => void;
        onViewPermisos?: (r: RoleWithCount) => void;
        onDelete?: (r: RoleWithCount) => void;
      };
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onEdit?.(row.original)}
            title="Editar info"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onViewPermisos?.(row.original)}
            title="Ver Permisos"
          >
            <Shield className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onDelete?.(row.original)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      );
    },
    enableSorting: false,
  },
];

export default function RolesPage() {
  const [data, setData] = useState<RoleWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithCount | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const roles = await getRolesWithCount();
      setData(roles);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(r: RoleWithCount) {
    setEditingRole(r);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingRole(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingRole(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  function handleViewPermisos(r: RoleWithCount) {
    router.push(`/security/roles/${r.id}`);
  }

  async function handleDelete(r: RoleWithCount) {
    if (!confirm(`¿Está seguro de eliminar el rol "${r.nombre}"?`)) return;
    try {
      await deleteRole(r.id);
      toast.success("Rol eliminado correctamente");
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el rol",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Roles y Permisos" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Rol"
        meta={{
          onEdit: handleEdit,
          onViewPermisos: handleViewPermisos,
          onDelete: handleDelete,
        }}
      />

      <RolForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        role={editingRole}
        onSaved={handleSaved}
      />
    </div>
  );
}
