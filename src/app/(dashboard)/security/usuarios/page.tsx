"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getUsuarios,
  getRoles,
  toggleUsuarioStatus,
} from "./actions";
import { UsuarioForm } from "@/components/security/UsuarioForm";
import type { UsuarioSistema } from "@/types/security";

const columns: ColumnDef<UsuarioSistema>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "rol_nombre",
    header: "Rol",
    cell: ({ row }) =>
      row.original.rol_nombre ? (
        <Badge variant="outline">{row.original.rol_nombre}</Badge>
      ) : (
        <Badge variant="secondary">Sin rol</Badge>
      ),
  },
  {
    accessorKey: "last_sign_in_at",
    header: "Último acceso",
    cell: ({ row }) =>
      row.original.last_sign_in_at
        ? new Date(row.original.last_sign_in_at).toLocaleDateString("es-AR")
        : "Nunca",
  },
  {
    id: "estado",
    header: "Estado",
    cell: ({ row }) => {
      const isBanned = !!row.original.banned_until;
      return (
        <Badge variant={isBanned ? "destructive" : "default"}>
          {isBanned ? "Inactivo" : "Activo"}
        </Badge>
      );
    },
  },
  {
    id: "acciones",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onEdit?: (u: UsuarioSistema) => void;
        onToggleStatus?: (u: UsuarioSistema) => void;
      };
      const isBanned = !!row.original.banned_until;
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onEdit?.(row.original)}
            title="Editar rol"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta?.onToggleStatus?.(row.original)}
            title={isBanned ? "Activar" : "Desactivar"}
          >
            {isBanned ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Ban className="h-4 w-4 text-red-600" />
            )}
          </Button>
        </div>
      );
    },
    enableSorting: false,
  },
];

export default function UsuariosPage() {
  const [data, setData] = useState<UsuarioSistema[]>([]);
  const [roles, setRoles] = useState<{ id: string; nombre: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioSistema | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usuarios, rolesList] = await Promise.all([
        getUsuarios(),
        getRoles(),
      ]);
      setData(usuarios);
      setRoles(rolesList);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(u: UsuarioSistema) {
    setEditingUsuario(u);
    setModalOpen(true);
  }

  function handleNew() {
    setEditingUsuario(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingUsuario(null);
  }

  function handleSaved() {
    handleModalClose();
    fetchData();
  }

  async function handleToggleStatus(u: UsuarioSistema) {
    const isBanned = !!u.banned_until;
    try {
      await toggleUsuarioStatus(u.id, !isBanned);
      toast.success(
        isBanned ? "Usuario activado" : "Usuario desactivado",
      );
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cambiar estado",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Usuarios del Sistema" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={data.length}
        page={1}
        pageSize={data.length || 50}
        onPageChange={() => {}}
        isLoading={isLoading}
        onNewClick={handleNew}
        newButtonLabel="Nuevo Usuario"
        meta={{ onEdit: handleEdit, onToggleStatus: handleToggleStatus }}
      />

      <UsuarioForm
        open={modalOpen}
        onOpenChange={handleModalClose}
        usuario={editingUsuario}
        roles={roles}
        onSaved={handleSaved}
      />
    </div>
  );
}
