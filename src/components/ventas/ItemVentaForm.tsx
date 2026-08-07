"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StockItemCombobox } from "@/components/stock/StockItemCombobox";
import { itemVentaSchema, type ItemVentaSchemaType } from "@/lib/schemas/ventas";
import {
  createItemVenta,
  updateItemVenta,
  getStockItemsForSelect,
} from "@/app/(dashboard)/ventas/items/actions";
import type { ItemVenta } from "@/types/ventas";
import type { StockItem } from "@/types/stock";

interface ItemVentaFormProps {
  open: boolean;
  onOpenChange: () => void;
  item: ItemVenta | null;
  onSaved: () => void;
}

export function ItemVentaForm({
  open,
  onOpenChange,
  item,
  onSaved,
}: ItemVentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const isEditing = !!item;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ItemVentaSchemaType>({
    resolver: zodResolver(itemVentaSchema),
  });

  useEffect(() => {
    if (open) {
      getStockItemsForSelect().then(setStockItems);
    }
  }, [open]);

  useEffect(() => {
    if (open && item) {
      reset({
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: Number(item.precio),
        activo: item.activo,
        stock_item_id: item.stock_item_id,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        precio: 0,
        activo: true,
        stock_item_id: null,
      });
    }
  }, [open, item, reset]);

  async function onSubmit(data: ItemVentaSchemaType) {
    setIsSubmitting(true);
    try {
      const payload = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        precio: data.precio,
        activo: data.activo,
        stock_item_id: data.stock_item_id || null,
      };
      if (isEditing) {
        await updateItemVenta(item.id, payload);
        toast.success("Ítem de venta actualizado correctamente");
      } else {
        await createItemVenta(payload);
        toast.success("Ítem de venta creado correctamente");
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
  const stockItemId = watch("stock_item_id");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Ítem de Venta" : "Nuevo Ítem de Venta"}
      description={
        isEditing
          ? `Editando ítem "${item?.nombre}"`
          : "Complete los datos del nuevo ítem de venta"
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} />
          {errors.nombre && (
            <p className="text-xs text-destructive">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input id="descripcion" {...register("descripcion")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="precio">Precio (ARS)</Label>
          <Input
            id="precio"
            type="number"
            step="0.01"
            {...register("precio", { valueAsNumber: true })}
          />
          {errors.precio && (
            <p className="text-xs text-destructive">{errors.precio.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="stock-vinculado">Stock vinculado (opcional)</Label>
          {/*
            `missingLabel` recién cuando la lista llegó: `stockItems` se carga
            async y `reset()` escribe `stock_item_id` sincrónicamente, así que
            antes de eso un vínculo perfectamente válido se vería como "no
            disponible" durante el primer render.
          */}
          <StockItemCombobox
            id="stock-vinculado"
            items={stockItems}
            value={stockItemId ?? null}
            onChange={(v) => setValue("stock_item_id", v)}
            clearLabel="Sin vínculo"
            placeholder="Sin vínculo"
            searchPlaceholder="Buscar ítem de stock..."
            emptyText="Sin ítems que coincidan"
            missingLabel={
              stockItems.length > 0 ? "(ítem no disponible)" : undefined
            }
            className="w-full"
            modal
          />
          <p className="text-xs text-muted-foreground">
            Al vender, se descontará stock automáticamente
          </p>
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
