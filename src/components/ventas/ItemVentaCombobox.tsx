"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/shared/Combobox";
import { formatCurrency } from "@/lib/format";
import type { ItemVenta } from "@/types/ventas";

/** Lo mínimo para identificar el ítem; el resto sólo enriquece búsqueda y fila. */
type ItemVentaOption = Pick<ItemVenta, "id" | "nombre"> &
  Partial<
    Pick<
      ItemVenta,
      "descripcion" | "precio" | "precio_no_socio" | "activo" | "stock_item"
    >
  >;

interface ItemVentaComboboxProps {
  items: ItemVentaOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Muestra el precio alineado a la derecha de cada fila (POS). */
  showPrecio?: boolean;
  /** Qué tarifa mostrar cuando `showPrecio`. Por defecto, la de socio. */
  tipoPrecio?: "socio" | "no_socio";
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  missingLabel?: string;
  disabled?: boolean;
  className?: string;
  modal?: boolean;
  id?: string;
}

/**
 * Selector de ítem de venta — siempre con buscador: con cientos de ítems una
 * lista sin filtrar es inusable en un mostrador.
 *
 * Busca por nombre, descripción y nombre del stock vinculado: `items_ventas` no
 * tiene código ni rubro, así que ése es todo el texto disponible.
 */
export function ItemVentaCombobox({
  items,
  showPrecio,
  tipoPrecio = "socio",
  ...props
}: ItemVentaComboboxProps) {
  const options: ComboboxOption[] = React.useMemo(
    () =>
      items.map((i) => {
        const precio = tipoPrecio === "no_socio" ? i.precio_no_socio : i.precio;
        return {
          value: i.id,
          label: i.nombre,
          keywords: [i.descripcion ?? "", i.stock_item?.nombre ?? ""].filter(
            Boolean,
          ),
          render: (
            <span className="flex w-full items-center gap-2">
              <span className="truncate">{i.nombre}</span>
              {i.activo === false && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  (inactivo)
                </span>
              )}
              {showPrecio && precio != null && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(Number(precio))}
                </span>
              )}
            </span>
          ),
        };
      }),
    // `tipoPrecio` va en las deps: sin él las filas quedan con la tarifa
    // vieja después de togglear Socio/No Socio en el POS.
    [items, showPrecio, tipoPrecio],
  );

  return <Combobox options={options} {...props} />;
}
