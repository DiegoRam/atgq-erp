"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { actividadSchema, type ActividadSchemaType } from "@/lib/schemas/actividades";
import {
  createActividad,
  updateActividad,
} from "@/app/(dashboard)/actividades/actions";
import type { Actividad } from "@/types/actividades";

interface ActividadFormProps {
  open: boolean;
  onOpenChange: () => void;
  actividad: Actividad | null;
  onSaved: () => void;
}

export function ActividadForm({
  open,
  onOpenChange,
  actividad,
  onSaved,
}: ActividadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!actividad;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ActividadSchemaType>({
    resolver: zodResolver(actividadSchema),
  });

  useEffect(() => {
    if (open && actividad) {
      reset({
        nombre: actividad.nombre,
        descripcion: actividad.descripcion,
        monto_cuota: actividad.monto_cuota != null ? Number(actividad.monto_cuota) : null,
        activa: actividad.activa,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        monto_cuota: null,
        activa: true,
      });
    }
  }, [open, actividad, reset]);

  async function onSubmit(data: ActividadSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateActividad(actividad.id, data);
        toast.success("Actividad actualizada correctamente");
      } else {
        await createActividad(data);
        toast.success("Actividad creada correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar la actividad",
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
      title={isEditing ? "Editar Actividad" : "Nueva Actividad"}
      description={
        isEditing
          ? `Editando actividad "${actividad?.nombre}"`
          : "Complete los datos de la nueva actividad"
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
          <Label htmlFor="monto_cuota">Monto Cuota ($)</Label>
          <Input
            id="monto_cuota"
            type="number"
            step="0.01"
            {...register("monto_cuota", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
          />
          {errors.monto_cuota && (
            <p className="text-xs text-red-500">{errors.monto_cuota.message}</p>
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
