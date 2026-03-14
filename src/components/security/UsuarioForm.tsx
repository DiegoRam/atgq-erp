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
  usuarioSchema,
  type UsuarioSchemaType,
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

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UsuarioSchemaType>({
    resolver: zodResolver(usuarioSchema),
  });

  useEffect(() => {
    if (open && usuario) {
      reset({ email: usuario.email, password: "", rol_id: usuario.rol_id ?? "" });
    } else if (open) {
      reset({ email: "", password: "", rol_id: "" });
    }
  }, [open, usuario, reset]);

  async function onSubmit(data: UsuarioSchemaType) {
    if (!isEditing && data.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateUsuarioRole(usuario.id, data.rol_id);
        toast.success("Rol actualizado correctamente");
      } else {
        await createUsuario({
          email: data.email,
          password: data.password,
          rol_id: data.rol_id,
        });
        toast.success("Usuario creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el usuario",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const rolValue = watch("rol_id");

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
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        {!isEditing && (
          <>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label htmlFor="rol_id">Rol</Label>
          <Select
            value={rolValue || ""}
            onValueChange={(v) => setValue("rol_id", v)}
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
          {errors.rol_id && (
            <p className="text-xs text-red-500">{errors.rol_id.message}</p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
