"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rolSchema, type RolSchemaType } from "@/lib/schemas/security";
import {
  createRole,
  updateRole,
} from "@/app/(dashboard)/security/roles/actions";
import type { Role } from "@/types/security";

interface RolFormProps {
  open: boolean;
  onOpenChange: () => void;
  role: Role | null;
  onSaved: () => void;
}

export function RolForm({ open, onOpenChange, role, onSaved }: RolFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!role;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RolSchemaType>({
    resolver: zodResolver(rolSchema),
  });

  useEffect(() => {
    if (open && role) {
      reset({ nombre: role.nombre, descripcion: role.descripcion });
    } else if (open) {
      reset({ nombre: "", descripcion: null });
    }
  }, [open, role, reset]);

  async function onSubmit(data: RolSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateRole(role.id, data);
        toast.success("Rol actualizado correctamente");
      } else {
        await createRole(data);
        toast.success("Rol creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el rol",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Rol" : "Nuevo Rol"}
      description={
        isEditing
          ? `Editando rol "${role?.nombre}"`
          : "Complete los datos del nuevo rol"
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} />
          {errors.nombre && (
            <p className="text-xs text-red-500">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input id="descripcion" {...register("descripcion")} />
        </div>
      </div>
    </FormModal>
  );
}
