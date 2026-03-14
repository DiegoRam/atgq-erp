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
  metodoCobranzaSchema,
  type MetodoCobranzaSchemaType,
} from "@/lib/schemas/socios-config";
import {
  createMetodoCobranza,
  updateMetodoCobranza,
} from "@/app/(dashboard)/socios/config/cobranzas/actions";
import type { MetodoCobranza } from "@/types/socios";

interface MetodoCobranzaFormProps {
  open: boolean;
  onOpenChange: () => void;
  metodo: MetodoCobranza | null;
  onSaved: () => void;
}

export function MetodoCobranzaForm({
  open,
  onOpenChange,
  metodo,
  onSaved,
}: MetodoCobranzaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!metodo;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MetodoCobranzaSchemaType>({
    resolver: zodResolver(metodoCobranzaSchema),
  });

  useEffect(() => {
    if (open && metodo) {
      reset({
        nombre: metodo.nombre,
        activo: metodo.activo,
      });
    } else if (open) {
      reset({
        nombre: "",
        activo: true,
      });
    }
  }, [open, metodo, reset]);

  async function onSubmit(data: MetodoCobranzaSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateMetodoCobranza(metodo.id, data);
        toast.success("Método de cobranza actualizado correctamente");
      } else {
        await createMetodoCobranza(data);
        toast.success("Método de cobranza creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al guardar el método de cobranza",
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
      title={isEditing ? "Editar Método de Cobranza" : "Nuevo Método de Cobranza"}
      description={
        isEditing
          ? `Editando método "${metodo?.nombre}"`
          : "Complete los datos del nuevo método de cobranza"
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
