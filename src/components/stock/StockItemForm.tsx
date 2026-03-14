"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { stockItemSchema, type StockItemSchemaType } from "@/lib/schemas/stock";
import {
  createStockItem,
  updateStockItem,
} from "@/app/(dashboard)/stock/items/actions";
import type { StockItem } from "@/types/stock";

interface StockItemFormProps {
  open: boolean;
  onOpenChange: () => void;
  item: StockItem | null;
  onSaved: () => void;
}

export function StockItemForm({
  open,
  onOpenChange,
  item,
  onSaved,
}: StockItemFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!item;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StockItemSchemaType>({
    resolver: zodResolver(stockItemSchema),
  });

  useEffect(() => {
    if (open && item) {
      reset({
        nombre: item.nombre,
        descripcion: item.descripcion,
        unidad: item.unidad,
        activo: item.activo,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        unidad: "unidad",
        activo: true,
        stock_inicial: undefined,
      });
    }
  }, [open, item, reset]);

  async function onSubmit(data: StockItemSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateStockItem(item.id, {
          nombre: data.nombre,
          descripcion: data.descripcion,
          unidad: data.unidad,
          activo: data.activo,
        });
        toast.success("Ítem actualizado correctamente");
      } else {
        await createStockItem(data);
        toast.success("Ítem creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el ítem",
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
      title={isEditing ? "Editar Ítem" : "Nuevo Ítem de Stock"}
      description={
        isEditing
          ? `Editando ítem "${item?.nombre}"`
          : "Complete los datos del nuevo ítem"
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
          <Label htmlFor="unidad">Unidad</Label>
          <Input id="unidad" {...register("unidad")} placeholder="unidad" />
          {errors.unidad && (
            <p className="text-xs text-red-500">{errors.unidad.message}</p>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-1">
            <Label htmlFor="stock_inicial">Stock Inicial (opcional)</Label>
            <Input
              id="stock_inicial"
              type="number"
              {...register("stock_inicial", { valueAsNumber: true })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Se ingresará en el Depósito Central
            </p>
          </div>
        )}

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
