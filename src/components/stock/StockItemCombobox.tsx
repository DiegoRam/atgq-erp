"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/shared/Combobox";
import type { StockItem } from "@/types/stock";

type StockItemOption = Pick<StockItem, "id" | "nombre"> &
  Partial<Pick<StockItem, "descripcion" | "unidad" | "activo">>;

interface StockItemComboboxProps {
  items: StockItemOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Muestra la unidad al lado del nombre. */
  showUnidad?: boolean;
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
 * Selector de ítem de stock — siempre con buscador: con cientos de ítems una
 * lista sin filtrar es inusable. Busca por nombre, descripción y unidad.
 */
export function StockItemCombobox({
  items,
  showUnidad,
  ...props
}: StockItemComboboxProps) {
  const options: ComboboxOption[] = React.useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: showUnidad && i.unidad ? `${i.nombre} (${i.unidad})` : i.nombre,
        keywords: [i.descripcion ?? "", i.unidad ?? ""].filter(Boolean),
        render: (
          <span className="flex w-full items-center gap-2">
            <span className="truncate">{i.nombre}</span>
            {showUnidad && i.unidad && (
              <span className="shrink-0 text-muted-foreground">
                ({i.unidad})
              </span>
            )}
            {i.activo === false && (
              <span className="shrink-0 text-xs text-muted-foreground">
                (inactivo)
              </span>
            )}
          </span>
        ),
      })),
    [items, showUnidad],
  );

  return <Combobox options={options} {...props} />;
}
