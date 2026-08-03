"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPuntosVentaParaFiltro } from "@/app/(dashboard)/ventas/actions";

/** Valor centinela: los Select de Radix no aceptan "" como value */
export const TODOS_PDV = "all";

/** Normaliza el valor del filtro para pasarlo a una server action */
export function pdvFiltro(value: string): string | undefined {
  return value && value !== TODOS_PDV ? value : undefined;
}

interface PuntoVentaFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Filtro de punto de venta compartido por los reportes de VENTAS */
export function PuntoVentaFilter({
  value,
  onChange,
  className = "w-48",
}: PuntoVentaFilterProps) {
  const [puntos, setPuntos] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    getPuntosVentaParaFiltro()
      .then(setPuntos)
      .catch(() => setPuntos([]));
  }, []);

  return (
    <div className="space-y-1">
      <Label className="text-xs">Punto de Venta</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS_PDV}>Todos</SelectItem>
          {puntos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
