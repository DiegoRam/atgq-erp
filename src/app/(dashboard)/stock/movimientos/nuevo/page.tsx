"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  movimientoStockSchema,
  type MovimientoStockSchemaType,
} from "@/lib/schemas/stock";
import {
  getDepositosActivos,
  getStockItemsActivos,
  getStockActual,
  registrarMovimientoStock,
} from "./actions";
import type { Deposito, StockItem } from "@/types/stock";

export default function NuevoMovimientoStockPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockActual, setStockActual] = useState<number | null>(null);
  const [depositoNombre, setDepositoNombre] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MovimientoStockSchemaType>({
    resolver: zodResolver(movimientoStockSchema),
    defaultValues: {
      tipo: "ingreso",
    },
  });

  const tipoValue = watch("tipo");
  const depositoIdValue = watch("deposito_id");
  const itemIdValue = watch("item_id");

  useEffect(() => {
    Promise.all([getDepositosActivos(), getStockItemsActivos()]).then(
      ([depData, itemData]) => {
        setDepositos(depData);
        setItems(itemData);
      },
    );
  }, []);

  // Fetch stock actual when deposito + item selected
  const fetchStockActual = useCallback(async () => {
    if (depositoIdValue && itemIdValue) {
      const stock = await getStockActual(depositoIdValue, itemIdValue);
      setStockActual(stock);
      const dep = depositos.find((d) => d.id === depositoIdValue);
      setDepositoNombre(dep?.nombre ?? "");
    } else {
      setStockActual(null);
    }
  }, [depositoIdValue, itemIdValue, depositos]);

  useEffect(() => {
    fetchStockActual();
  }, [fetchStockActual]);

  function resetForm() {
    reset({
      tipo: "ingreso",
      deposito_id: "" as unknown as string,
      item_id: "" as unknown as string,
      cantidad: undefined as unknown as number,
      motivo: null,
    });
    setStockActual(null);
  }

  async function onSubmit(data: MovimientoStockSchemaType) {
    setIsSubmitting(true);
    try {
      const result = await registrarMovimientoStock(data);
      const itemName =
        items.find((i) => i.id === data.item_id)?.nombre ?? "el ítem";

      if (result.warning) {
        toast.warning(
          `Movimiento registrado. Stock de ${itemName}: ${result.nuevoStock}. ${result.warning}`,
          { duration: 8000 },
        );
      } else {
        toast.success(
          `Movimiento registrado. Nuevo stock de ${itemName}: ${result.nuevoStock}`,
          {
            action: {
              label: "Registrar otro",
              onClick: resetForm,
            },
            duration: 8000,
          },
        );
      }
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar movimiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ingresos / Egresos de Stock"
        description="Registrar un nuevo movimiento de stock"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos del Movimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select
                    value={tipoValue || "ingreso"}
                    onValueChange={(v) =>
                      setValue("tipo", v as "ingreso" | "egreso")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="egreso">Egreso</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.tipo && (
                    <p className="text-xs text-red-500">
                      {errors.tipo.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Depósito</Label>
                  <Select
                    value={depositoIdValue || ""}
                    onValueChange={(v) => setValue("deposito_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar depósito..." />
                    </SelectTrigger>
                    <SelectContent>
                      {depositos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.deposito_id && (
                    <p className="text-xs text-red-500">
                      {errors.deposito_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Ítem</Label>
                  <Select
                    value={itemIdValue || ""}
                    onValueChange={(v) => setValue("item_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ítem..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.item_id && (
                    <p className="text-xs text-red-500">
                      {errors.item_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cantidad">Cantidad</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    {...register("cantidad", { valueAsNumber: true })}
                    placeholder="0"
                  />
                  {errors.cantidad && (
                    <p className="text-xs text-red-500">
                      {errors.cantidad.message}
                    </p>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <Label htmlFor="motivo">
                    Motivo {tipoValue === "egreso" && "(requerido)"}
                  </Label>
                  <Input
                    id="motivo"
                    {...register("motivo")}
                    placeholder="Motivo del movimiento..."
                  />
                  {errors.motivo && (
                    <p className="text-xs text-red-500">
                      {errors.motivo.message}
                    </p>
                  )}
                </div>
              </div>

              {stockActual !== null && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Stock actual en{" "}
                  <span className="font-medium">{depositoNombre}</span>:{" "}
                  <span
                    className={`font-semibold ${stockActual <= 0 ? "text-red-600" : stockActual <= 10 ? "text-orange-600" : ""}`}
                  >
                    {stockActual} unidades
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Registrar Movimiento
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
