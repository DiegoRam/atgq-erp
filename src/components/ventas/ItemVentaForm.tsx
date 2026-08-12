"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Misma regla que el backfill de la migración
 * 20260812000001_items_ventas_precio_no_socio.sql: socio + 20%, 2 decimales.
 */
function precioNoSocioSugerido(precio: number) {
  return Number((precio * 1.2).toFixed(2));
}

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
  // Mientras esté en false, el precio de no socio sigue al de socio a +20%
  const [precioNoSocioManual, setPrecioNoSocioManual] = useState(false);
  // El modal no desmonta este componente al cerrarse (Radix sólo desmonta el
  // DialogContent), así que el estado sobrevive de un ítem al siguiente.
  const recienReseteadoRef = useRef(false);
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
      const p = Number(item.precio);
      const pns = Number(item.precio_no_socio);
      reset({
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: p,
        precio_no_socio: pns,
        activo: item.activo,
        stock_item_id: item.stock_item_id,
      });
      // Si el par guardado ya cumple la regla, el campo sigue enganchado. Si
      // diverge (los ítems con tarifa propia del legacy) fue puesto a mano y
      // no se toca: sería pisar justo el dato que vinimos a rescatar.
      setPrecioNoSocioManual(precioNoSocioSugerido(p) !== pns);
      recienReseteadoRef.current = true;
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        precio: 0,
        precio_no_socio: 0,
        activo: true,
        stock_item_id: null,
      });
      setPrecioNoSocioManual(false);
      recienReseteadoRef.current = true;
    }
  }, [open, item, reset]);

  const precio = watch("precio");

  // Enganche en vivo del +20%. El guard de Number.isFinite es lo que evita
  // escribir NaN mientras el input de socio está vacío (`valueAsNumber`):
  // el campo se congela en su último valor en vez de vaciarse y fallar la
  // validación en un campo que el usuario nunca tocó.
  useEffect(() => {
    // El efecto de reset corre justo antes que éste en el MISMO commit, pero
    // acá `precio` y `precioNoSocioManual` son todavía los del render
    // anterior: sin este guard, abrir un ítem después de otro le pisaba el
    // precio_no_socio guardado con el sugerido del ítem previo — y como el
    // flag manual ya quedaba en true, no se corregía nunca. Justo destruía
    // las tarifas del legacy que esta feature vino a rescatar.
    if (recienReseteadoRef.current) {
      recienReseteadoRef.current = false;
      return;
    }
    if (!open || precioNoSocioManual) return;
    if (!Number.isFinite(precio)) return;
    setValue("precio_no_socio", precioNoSocioSugerido(precio), {
      shouldValidate: false,
      shouldDirty: false,
    });
  }, [open, precio, precioNoSocioManual, setValue]);

  async function onSubmit(data: ItemVentaSchemaType) {
    setIsSubmitting(true);
    try {
      const payload = {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        precio: data.precio,
        precio_no_socio: data.precio_no_socio,
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
          <Label htmlFor="precio">Precio Socio (ARS)</Label>
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
          <Label htmlFor="precio_no_socio">Precio No Socio (ARS)</Label>
          {/*
            El enganche se corta con el primer tipeo real y no con el blur:
            `touchedFields` sólo se prende al salir del campo, así que tipear
            sin salir dejaría que la próxima tecla en "precio" pise lo
            cargado. `setValue()` no dispara este onChange.
          */}
          <Input
            id="precio_no_socio"
            type="number"
            step="0.01"
            {...register("precio_no_socio", {
              valueAsNumber: true,
              onChange: () => setPrecioNoSocioManual(true),
            })}
          />
          {errors.precio_no_socio && (
            <p className="text-xs text-destructive">
              {errors.precio_no_socio.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {precioNoSocioManual ? (
              <>
                Precio manual.{" "}
                {/* type="button" explícito: el default de un <button> es
                    "submit", y no depender de que FormModal hoy no monte un
                    <form> alrededor */}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setPrecioNoSocioManual(false)}
                >
                  Volver a socio + 20%
                </button>
              </>
            ) : (
              "Se autocompleta como precio de socio + 20% hasta que lo edite."
            )}
          </p>
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
