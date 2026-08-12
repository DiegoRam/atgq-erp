"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/shared/Combobox";
import { formatCurrency } from "@/lib/format";
import type { ItemVenta, TipoPrecio } from "@/types/ventas";

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
  /**
   * Muestra los precios alineados a la derecha de cada fila (POS): socio y
   * no socio, en ese orden, o uno solo si coinciden.
   */
  showPrecio?: boolean;
  /** Cuál de las dos tarifas está vigente (se resalta). Por defecto, socio. */
  tipoPrecio?: TipoPrecio;
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
        // Se muestran las dos tarifas — con el catálogo legacy la mayoría
        // coincide, y viendo una sola el cajero no sabe si el toggle aplicó.
        const socio = i.precio != null ? Number(i.precio) : null;
        const noSocio =
          i.precio_no_socio != null ? Number(i.precio_no_socio) : null;
        const hayDos = socio != null && noSocio != null && socio !== noSocio;
        const precio = tipoPrecio === "no_socio" ? noSocio : socio;
        const activa = (cual: TipoPrecio) =>
          cual === tipoPrecio
            ? "font-medium text-foreground"
            : "text-muted-foreground";
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
              {showPrecio &&
                (hayDos ? (
                  <span className="ml-auto shrink-0 tabular-nums">
                    <span className={activa("socio")}>
                      {formatCurrency(socio)}
                    </span>
                    <span className="text-muted-foreground"> / </span>
                    <span className={activa("no_socio")}>
                      {formatCurrency(noSocio)}
                    </span>
                  </span>
                ) : (
                  precio != null && (
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrency(precio)}
                    </span>
                  )
                ))}
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
