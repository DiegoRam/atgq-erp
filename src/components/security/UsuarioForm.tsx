"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usuarioCreateSchema,
  usuarioEditSchema,
  type UsuarioCreateSchemaType,
  type UsuarioEditSchemaType,
} from "@/lib/schemas/security";
import {
  createUsuario,
  updateUsuarioRole,
} from "@/app/(dashboard)/security/usuarios/actions";
import type { UsuarioSistema } from "@/types/security";

interface UsuarioFormProps {
  open: boolean;
  onOpenChange: () => void;
  usuario: UsuarioSistema | null;
  roles: { id: string; nombre: string }[];
  onSaved: () => void;
}

export function UsuarioForm({
  open,
  onOpenChange,
  usuario,
  roles,
  onSaved,
}: UsuarioFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!usuario;

  const createForm = useForm<UsuarioCreateSchemaType>({
    resolver: zodResolver(usuarioCreateSchema),
  });

  const editForm = useForm<UsuarioEditSchemaType>({
    resolver: zodResolver(usuarioEditSchema),
  });

  useEffect(() => {
    if (open && usuario) {
      editForm.reset({ rol_id: usuario.rol_id ?? "" });
    } else if (open) {
      createForm.reset({ email: "", password: "", rol_id: "" });
    }
  }, [open, usuario, createForm, editForm]);

  async function onCreateSubmit(data: UsuarioCreateSchemaType) {
    setIsSubmitting(true);
    try {
      await createUsuario({
        email: data.email,
        password: data.password,
        rol_id: data.rol_id,
      });
      toast.success("Usuario creado correctamente");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el usuario",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onEditSubmit(data: UsuarioEditSchemaType) {
    setIsSubmitting(true);
    try {
      await updateUsuarioRole(usuario!.id, data.rol_id);
      toast.success("Rol actualizado correctamente");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el rol",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const rolValue = isEditing
    ? editForm.watch("rol_id")
    : createForm.watch("rol_id");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Rol de Usuario" : "Nuevo Usuario"}
      description={
        isEditing
          ? `Editando rol de "${usuario?.email}"`
          : "Complete los datos del nuevo usuario"
      }
      onSubmit={
        isEditing
          ? editForm.handleSubmit(onEditSubmit)
          : createForm.handleSubmit(onCreateSubmit)
      }
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        {!isEditing && (
          <>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...createForm.register("email")}
              />
              {createForm.formState.errors.email && (
                <p className="text-xs text-red-500">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                {...createForm.register("password")}
              />
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-500">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label htmlFor="rol_id">Rol</Label>
          <Select
            value={rolValue || ""}
            onValueChange={(v) =>
              isEditing
                ? editForm.setValue("rol_id", v)
                : createForm.setValue("rol_id", v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar rol..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(isEditing
            ? editForm.formState.errors.rol_id
            : createForm.formState.errors.rol_id) && (
            <p className="text-xs text-red-500">
              {isEditing
                ? editForm.formState.errors.rol_id?.message
                : createForm.formState.errors.rol_id?.message}
            </p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
