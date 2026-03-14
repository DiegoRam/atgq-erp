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
  tipoCuotaSchema,
  type TipoCuotaSchemaType,
} from "@/lib/schemas/socios-config";
import {
  createTipoCuota,
  updateTipoCuota,
} from "@/app/(dashboard)/socios/config/tipo-cuotas/actions";
import type { TipoCuota } from "@/types/socios";

interface TipoCuotaFormProps {
  open: boolean;
  onOpenChange: () => void;
  tipoCuota: TipoCuota | null;
  onSaved: () => void;
}

export function TipoCuotaForm({
  open,
  onOpenChange,
  tipoCuota,
  onSaved,
}: TipoCuotaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!tipoCuota;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TipoCuotaSchemaType>({
    resolver: zodResolver(tipoCuotaSchema),
  });

  useEffect(() => {
    if (open && tipoCuota) {
      reset({
        nombre: tipoCuota.nombre,
        descripcion: tipoCuota.descripcion,
        activo: tipoCuota.activo,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        activo: true,
      });
    }
  }, [open, tipoCuota, reset]);

  async function onSubmit(data: TipoCuotaSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateTipoCuota(tipoCuota.id, data);
        toast.success("Tipo de cuota actualizado correctamente");
      } else {
        await createTipoCuota(data);
        toast.success("Tipo de cuota creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al guardar el tipo de cuota",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const activoValue = watch("activo");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Tipo de Cuota" : "Nuevo Tipo de Cuota"}
      description={
        isEditing
          ? `Editando tipo "${tipoCuota?.nombre}"`
          : "Complete los datos del nuevo tipo de cuota"
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

        <div className="flex items-center gap-2">
          <Switch
            id="activo"
            checked={activoValue ?? true}
            onCheckedChange={(v) => setValue("activo", v)}
          />
          <Label htmlFor="activo">Activo</Label>
        </div>
      </div>
    </FormModal>
  );
}
