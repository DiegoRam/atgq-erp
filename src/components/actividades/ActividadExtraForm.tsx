"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actividadExtraSchema, type ActividadExtraSchemaType } from "@/lib/schemas/actividades";
import {
  createActividadExtra,
  updateActividadExtra,
} from "@/app/(dashboard)/actividades/extras/actions";
import type { ActividadExtra } from "@/types/actividades";

interface ActividadExtraFormProps {
  open: boolean;
  onOpenChange: () => void;
  extra: ActividadExtra | null;
  onSaved: () => void;
}

export function ActividadExtraForm({
  open,
  onOpenChange,
  extra,
  onSaved,
}: ActividadExtraFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!extra;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActividadExtraSchemaType>({
    resolver: zodResolver(actividadExtraSchema),
  });

  useEffect(() => {
    if (open && extra) {
      reset({
        nombre: extra.nombre,
        descripcion: extra.descripcion,
        fecha: extra.fecha,
        monto: extra.monto != null ? Number(extra.monto) : null,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        fecha: null,
        monto: null,
      });
    }
  }, [open, extra, reset]);

  async function onSubmit(data: ActividadExtraSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateActividadExtra(extra.id, data);
        toast.success("Actividad extra actualizada correctamente");
      } else {
        await createActividadExtra(data);
        toast.success("Actividad extra creada correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Actividad Extra" : "Nueva Actividad Extra"}
      description={
        isEditing
          ? `Editando "${extra?.nombre}"`
          : "Complete los datos de la nueva actividad extra"
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
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" {...register("fecha")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="monto">Monto ($)</Label>
          <Input
            id="monto"
            type="number"
            step="0.01"
            {...register("monto", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
          />
          {errors.monto && (
            <p className="text-xs text-red-500">{errors.monto.message}</p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
