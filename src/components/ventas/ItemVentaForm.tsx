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
import {
  precioNoSocioSugerido,
  RECARGO_NO_SOCIO_FALLBACK,
} from "@/lib/precios";
import { formatPorcentaje } from "@/lib/format";
import type { ItemVenta } from "@/types/ventas";
import type { StockItem } from "@/types/stock";

interface ItemVentaFormProps {
  open: boolean;
  onOpenChange: () => void;
  item: ItemVenta | null;
  onSaved: () => void;
  /**
   * Recargo para no socios, en %, leído de `configuracion`. `null` mientras
   * carga: en ese caso se usa el fallback, que es el mismo default de la
   * columna.
   */
  recargoPct: number | null;
}

export function ItemVentaForm({
  open,
  onOpenChange,
  item,
  onSaved,
  recargoPct,
}: ItemVentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  // Mientras esté en false, el precio de no socio sigue al de socio a +pct%
  const [precioNoSocioManual, setPrecioNoSocioManual] = useState(false);
  // El modal no desmonta este componente al cerrarse (Radix sólo desmonta el
  // DialogContent), así que el estado sobrevive de un ítem al siguiente.
  const recienReseteadoRef = useRef(false);
  // El prop llega asíncrono. Se espeja en un ref para poder leerlo al abrir el
  // modal sin meterlo como dependencia del efecto de reset: una llegada tardía
  // volvería a correr reset() y borraría lo que el usuario ya tipeó.
  const recargoPctRef = useRef(recargoPct);
  // El pct con el que se abrió este modal. Congelado a propósito — ver el
  // efecto de reset.
  const pctRef = useRef(RECARGO_NO_SOCIO_FALLBACK);
  // true si lo congelado es el fallback y no el valor real de la config.
  const pctProvisorioRef = useRef(false);
  // Copia en estado sólo para el texto de ayuda, que sí tiene que re-renderear.
  const [pctVisible, setPctVisible] = useState(RECARGO_NO_SOCIO_FALLBACK);
  const isEditing = !!item;

  useEffect(() => {
    recargoPctRef.current = recargoPct;
  }, [recargoPct]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm<ItemVentaSchemaType>({
    resolver: zodResolver(itemVentaSchema),
  });

  useEffect(() => {
    if (open) {
      getStockItemsForSelect().then(setStockItems);
    }
  }, [open]);

  useEffect(() => {
    // El pct se CONGELA acá, al abrir. Si el efecto de enganche lo leyera
    // reactivo, un cambio de configuración —o simplemente la llegada tardía
    // del prop— volvería a disparar setValue() y le pisaría el
    // precio_no_socio guardado al ítem en edición: el mismo bug que
    // recienReseteadoRef ya evita para el cambio de ítem.
    const pct = recargoPctRef.current ?? RECARGO_NO_SOCIO_FALLBACK;
    pctRef.current = pct;
    setPctVisible(pct);
    // Si se congeló el fallback porque el prop todavía no había llegado, el
    // efecto de abajo re-congela cuando llegue. Ver ahí por qué.
    pctProvisorioRef.current = recargoPctRef.current === null;

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
      setPrecioNoSocioManual(precioNoSocioSugerido(p, pct) !== pns);
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

  // Re-congelado por única vez, para el caso en que el modal se abrió antes de
  // que `getRecargoNoSocioPct()` respondiera: ahí se congeló el fallback de 20
  // y el texto de ayuda afirmaba "socio + 20%" aunque el club tuviera otro
  // valor configurado — un precio equivocado con una etiqueta convencida.
  //
  // Sólo se re-congela mientras el form sigue **pristino** (`!isDirty`): si el
  // usuario ya tipeó algo, se respeta lo que tiene en pantalla y el pct
  // congelado, que es lo que evita reintroducir el bug de pisarle el valor
  // cargado. `setValue(..., shouldDirty: false)` del autocompletado no ensucia
  // el form, así que el autofill previo no bloquea esta corrección.
  useEffect(() => {
    if (!open || recargoPct === null || !pctProvisorioRef.current) return;
    if (isDirty) return;

    pctProvisorioRef.current = false;
    pctRef.current = recargoPct;
    setPctVisible(recargoPct);

    const p = Number(getValues("precio"));
    if (!Number.isFinite(p)) return;

    if (item) {
      // Re-deriva si la tarifa guardada era manual: se había evaluado contra
      // el pct equivocado.
      setPrecioNoSocioManual(
        precioNoSocioSugerido(p, recargoPct) !== Number(item.precio_no_socio),
      );
    } else {
      setValue("precio_no_socio", precioNoSocioSugerido(p, recargoPct), {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [open, recargoPct, isDirty, item, getValues, setValue]);

  const precio = watch("precio");

  // Enganche en vivo del recargo. El guard de Number.isFinite es lo que evita
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
    // pctRef y no el prop: las dependencias de este efecto quedan iguales a
    // antes justamente para que el recargo no pueda re-dispararlo.
    setValue("precio_no_socio", precioNoSocioSugerido(precio, pctRef.current), {
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
                  {/* Con recargo 0 no hay "+0%" que mostrar: se lee mal */}
                  {pctVisible === 0
                    ? "Volver al precio de socio"
                    : `Volver a socio + ${formatPorcentaje(pctVisible)}%`}
                </button>
              </>
            ) : pctVisible === 0 ? (
              "Se autocompleta con el mismo precio del socio hasta que lo edite."
            ) : (
              `Se autocompleta como precio de socio + ${formatPorcentaje(pctVisible)}% hasta que lo edite.`
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
