"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CartItem, TipoPrecio } from "@/types/ventas";

interface CarritoVentaProps {
  items: CartItem[];
  onRemove: (index: number) => void;
  /** Tarifa con la que se cargaron las líneas; se nombra en el encabezado. */
  tipoPrecio: TipoPrecio;
}

/**
 * Legado: `ValorSocio = 0` marcaba "esto no se le vende a socios", y hay
 * además ítems con las DOS tarifas en $0. Hoy nada impide cobrarlos gratis,
 * así que al menos que el cajero vea que está regalando el ítem.
 */
const sinTarifa = (item: CartItem) => item.precio_unitario === 0;

export function CarritoVenta({
  items,
  onRemove,
  tipoPrecio,
}: CarritoVentaProps) {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const haySinTarifa = items.some(sinTarifa);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ítem</TableHead>
              <TableHead className="text-right">
                Precio ({tipoPrecio === "socio" ? "Socio" : "No Socio"})
              </TableHead>
              <TableHead className="text-center">Cant.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  Agregue ítems a la venta
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="text-right">
                    {sinTarifa(item) ? (
                      <span className="text-destructive">
                        {formatCurrency(0)}
                        <span className="block text-xs">
                          sin tarifa de{" "}
                          {tipoPrecio === "socio" ? "socio" : "no socio"}
                        </span>
                      </span>
                    ) : (
                      formatCurrency(item.precio_unitario)
                    )}
                  </TableCell>
                  <TableCell className="text-center">{item.cantidad}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(item.subtotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {items.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">
                  TOTAL
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  {formatCurrency(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {haySinTarifa && (
        <p className="text-xs text-destructive">
          Hay ítems en $0 para esta tarifa. Verifique si corresponden sólo al
          otro tipo de comprador o si falta cargarles el precio.
        </p>
      )}
    </div>
  );
}
