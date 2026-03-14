"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cajaSchema, type CajaSchemaType } from "@/lib/schemas/tesoreria";
import {
  createCaja,
  updateCaja,
} from "@/app/(dashboard)/tesoreria/cajas/actions";
import type { Caja } from "@/types/tesoreria";

interface CajaFormProps {
  open: boolean;
  onOpenChange: () => void;
  caja: Caja | null;
  onSaved: () => void;
}

export function CajaForm({ open, onOpenChange, caja, onSaved }: CajaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!caja;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CajaSchemaType>({
    resolver: zodResolver(cajaSchema),
  });

  useEffect(() => {
    if (open && caja) {
      reset({
        nombre: caja.nombre,
        descripcion: caja.descripcion,
        saldo_inicial: Number(caja.saldo_inicial),
        activa: caja.activa,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        saldo_inicial: 0,
        activa: true,
      });
    }
  }, [open, caja, reset]);

  async function onSubmit(data: CajaSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateCaja(caja.id, data);
        toast.success("Caja actualizada correctamente");
      } else {
        await createCaja(data);
        toast.success("Caja creada correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar la caja",
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
      title={isEditing ? "Editar Caja" : "Nueva Caja"}
      description={
        isEditing
          ? `Editando caja "${caja?.nombre}"`
          : "Complete los datos de la nueva caja"
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
          <Label htmlFor="saldo_inicial">Saldo Inicial ($)</Label>
          <Input
            id="saldo_inicial"
            type="number"
            step="0.01"
            {...register("saldo_inicial", { valueAsNumber: true })}
          />
          {errors.saldo_inicial && (
            <p className="text-xs text-red-500">
              {errors.saldo_inicial.message}
            </p>
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
