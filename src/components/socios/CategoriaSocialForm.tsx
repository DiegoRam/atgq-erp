"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  categoriaSocialSchema,
  type CategoriaSocialSchemaType,
} from "@/lib/schemas/socios-config";
import {
  createCategoriaSocial,
  updateCategoriaSocial,
} from "@/app/(dashboard)/socios/config/categorias/actions";
import type { CategoriaSocial } from "@/types/socios";

interface CategoriaSocialFormProps {
  open: boolean;
  onOpenChange: () => void;
  categoria: CategoriaSocial | null;
  onSaved: () => void;
}

export function CategoriaSocialForm({
  open,
  onOpenChange,
  categoria,
  onSaved,
}: CategoriaSocialFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!categoria;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoriaSocialSchemaType>({
    resolver: zodResolver(categoriaSocialSchema),
  });

  useEffect(() => {
    if (open && categoria) {
      reset({
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        monto_base: categoria.monto_base,
        activa: categoria.activa,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        monto_base: null,
        activa: true,
      });
    }
  }, [open, categoria, reset]);

  async function onSubmit(data: CategoriaSocialSchemaType) {
    setIsSubmitting(true);
    try {
      const formData = {
        ...data,
        monto_base: data.monto_base != null && !Number.isNaN(data.monto_base) ? data.monto_base : null,
      };
      if (isEditing) {
        await updateCategoriaSocial(categoria.id, formData);
        toast.success("Categoría actualizada correctamente");
      } else {
        await createCategoriaSocial(formData);
        toast.success("Categoría creada correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar la categoría",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const activaValue = watch("activa");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Categoría" : "Nueva Categoría"}
      description={
        isEditing
          ? `Editando categoría "${categoria?.nombre}"`
          : "Complete los datos de la nueva categoría"
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

        <div className="space-y-1">
          <Label htmlFor="monto_base">Monto Base (ARS)</Label>
          <Input
            id="monto_base"
            type="number"
            step="0.01"
            {...register("monto_base", { valueAsNumber: true })}
          />
          {errors.monto_base && (
            <p className="text-xs text-red-500">{errors.monto_base.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="activa"
            checked={activaValue ?? true}
            onCheckedChange={(v) => setValue("activa", v)}
          />
          <Label htmlFor="activa">Activa</Label>
        </div>
      </div>
    </FormModal>
  );
}
