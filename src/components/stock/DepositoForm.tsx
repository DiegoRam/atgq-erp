"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { depositoSchema, type DepositoSchemaType } from "@/lib/schemas/stock";
import {
  createDeposito,
  updateDeposito,
} from "@/app/(dashboard)/stock/depositos/actions";
import type { Deposito } from "@/types/stock";

interface DepositoFormProps {
  open: boolean;
  onOpenChange: () => void;
  deposito: Deposito | null;
  onSaved: () => void;
}

export function DepositoForm({
  open,
  onOpenChange,
  deposito,
  onSaved,
}: DepositoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!deposito;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositoSchemaType>({
    resolver: zodResolver(depositoSchema),
  });

  useEffect(() => {
    if (open && deposito) {
      reset({
        nombre: deposito.nombre,
        descripcion: deposito.descripcion,
        activo: deposito.activo,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        activo: true,
      });
    }
  }, [open, deposito, reset]);

  async function onSubmit(data: DepositoSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateDeposito(deposito.id, data);
        toast.success("Depósito actualizado correctamente");
      } else {
        await createDeposito(data);
        toast.success("Depósito creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el depósito",
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
      title={isEditing ? "Editar Depósito" : "Nuevo Depósito"}
      description={
        isEditing
          ? `Editando depósito "${deposito?.nombre}"`
          : "Complete los datos del nuevo depósito"
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
