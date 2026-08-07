"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/shared/Combobox";
import { formatCurrency } from "@/lib/format";
import type { ItemVenta } from "@/types/ventas";

/** Lo mínimo para identificar el ítem; el resto sólo enriquece búsqueda y fila. */
type ItemVentaOption = Pick<ItemVenta, "id" | "nombre"> &
  Partial<Pick<ItemVenta, "descripcion" | "precio" | "activo" | "stock_item">>;

interface ItemVentaComboboxProps {
  items: ItemVentaOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Muestra el precio alineado a la derecha de cada fila (POS). */
  showPrecio?: boolean;
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
  ...props
}: ItemVentaComboboxProps) {
  const options: ComboboxOption[] = React.useMemo(
    () =>
      items.map((i) => ({
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
            {showPrecio && i.precio != null && (
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {formatCurrency(Number(i.precio))}
              </span>
            )}
          </span>
        ),
      })),
    [items, showPrecio],
  );

  return <Combobox options={options} {...props} />;
}
