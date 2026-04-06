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
import type { CartItem } from "@/types/ventas";

interface CarritoVentaProps {
  items: CartItem[];
  onRemove: (index: number) => void;
}

export function CarritoVenta({ items, onRemove }: CarritoVentaProps) {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ítem</TableHead>
            <TableHead className="text-right">Precio</TableHead>
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
                  {formatCurrency(item.precio_unitario)}
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
                    <Trash2 className="h-4 w-4 text-red-500" />
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
  );
}
