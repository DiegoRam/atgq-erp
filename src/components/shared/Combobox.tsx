"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCommandState } from "cmdk";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  /** Único (uuid). cmdk identifica cada fila por acá. */
  value: string;
  /** Texto del trigger y fallback de la fila. */
  label: string;
  /** Texto extra buscable (descripción, unidad, stock vinculado). */
  keywords?: string[];
  /** Fila custom (precio, unidad). Por defecto se muestra `label`. */
  render?: React.ReactNode;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Trigger sin selección. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * Si está presente, agrega una fila que limpia la selección (→ `onChange(null)`).
   * Es lo que vuelve opcional al combo: "Todos", "Sin vínculo".
   */
  clearLabel?: string;
  /** Trigger cuando el `value` guardado ya no está en `options` (ítem dado de baja). */
  missingLabel?: string;
  disabled?: boolean;
  /** Ancho del trigger. */
  className?: string;
  /** `true` cuando vive dentro de un Dialog (FormModal). */
  modal?: boolean;
  id?: string;
}

/** No puede colisionar con un uuid. */
const CLEAR_VALUE = "__combobox_clear__";

/**
 * Anuncia cuántas opciones quedan al filtrar. Sin esto, quien usa lector de
 * pantalla tipea y no recibe ninguna señal de si quedaron 3 resultados o ninguno
 * (`CommandEmpty` se renderiza con `role="presentation"`, invisible para AT).
 */
function ResultCount() {
  const count = useCommandState((state) => state.filtered.count);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {count === 0
        ? "Sin resultados"
        : `${count} ${count === 1 ? "resultado" : "resultados"}`}
    </div>
  );
}

/** Sin acentos y en minúsculas: "municion" tiene que encontrar "Munición". */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  clearLabel,
  missingLabel,
  disabled,
  className,
  modal,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  /** Se normaliza una sola vez por cambio de opciones, no en cada tecla. */
  const haystacks = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) {
      map.set(o.value, normalize([o.label, ...(o.keywords ?? [])].join(" ")));
    }
    if (clearLabel) map.set(CLEAR_VALUE, normalize(clearLabel));
    return map;
  }, [options, clearLabel]);

  /**
   * cmdk puntúa contra el prop `value` — que acá es un uuid — así que su filtro
   * por defecto no matchearía nada. Se filtra por `keywords` (ya normalizadas),
   * exigiendo todos los términos y priorizando los prefijos: en un POS "cart"
   * tiene que traer "Cartucho" primero, no un fuzzy impredecible.
   */
  const filter = React.useCallback(
    (value: string, search: string, keywords?: string[]) => {
      const terms = normalize(search).split(/\s+/).filter(Boolean);
      if (terms.length === 0) return 1;
      const hay = (keywords ?? []).join(" ");
      if (!terms.every((t) => hay.includes(t))) return 0;
      // La fila que limpia va primera en el DOM y el sort es estable, así que con
      // el mismo puntaje ganaría los empates: tipear "s" y apretar Enter limpiaría
      // el filtro en vez de elegir el primer resultado real. Se la deja en una
      // banda más baja — sigue siendo encontrable tipeando "todos", pero nunca
      // por encima de una coincidencia real.
      if (value === CLEAR_VALUE) return 1;
      return hay.startsWith(terms[0]) ? 3 : 2;
    },
    [],
  );

  function handleSelect(next: string) {
    onChange(next === CLEAR_VALUE ? null : next);
    setOpen(false);
  }

  const triggerLabel = selected
    ? selected.label
    : value && missingLabel
      ? missingLabel
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {triggerLabel}
          </span>
          <ChevronsUpDown
            aria-hidden
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={searchPlaceholder}
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
      >
        {/*
          `defaultValue` es lo que deja resaltada la opción ya elegida al abrir.
          Sin eso cmdk resalta la primera fila del catálogo, y como el popover se
          desmonta al cerrar, un Enter sobre el combo ya seleccionado cambiaría el
          ítem en silencio — en un mostrador eso es cargar mal la venta.
        */}
        <Command
          filter={filter}
          loop
          defaultValue={value ?? undefined}
          label={searchPlaceholder}
          // Sin esto, Tab desde el buscador dismissea el popover por interacción
          // externa y Radix deja de devolver el foco al trigger: el usuario queda
          // en `<body>` y pierde su lugar dentro del formulario.
          onKeyDown={(e) => {
            if (e.key === "Tab") setOpen(false);
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <ResultCount />
          <CommandList label="Sugerencias">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem
                  value={CLEAR_VALUE}
                  keywords={[haystacks.get(CLEAR_VALUE) ?? ""]}
                  onSelect={handleSelect}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground">{clearLabel}</span>
                  {value === null && (
                    <span className="sr-only">Seleccionado</span>
                  )}
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[haystacks.get(o.value) ?? ""]}
                  disabled={o.disabled}
                  onSelect={handleSelect}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.render ?? o.label}
                  {/*
                    En cmdk `aria-selected` significa "resaltado", no "elegido":
                    sin esto la única señal de cuál está elegido es el ícono.
                  */}
                  {value === o.value && (
                    <span className="sr-only">Seleccionado</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
