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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import {
  transferenciaStockSchema,
  type TransferenciaStockSchemaType,
} from "@/lib/schemas/stock";
import { formatDate } from "@/lib/format";
import {
  getUbicacionesActivas,
  getStockItemsActivos,
  getStockPorUbicacion,
  transferirStock,
  getUltimasTransferenciasStock,
} from "./actions";
import type { Deposito, StockItem, MovimientoStock } from "@/types/stock";

export default function TransferenciasStockPage() {
  const [ubicaciones, setUbicaciones] = useState<Deposito[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [transferencias, setTransferencias] = useState<MovimientoStock[]>([]);
  const [stockPorUbicacion, setStockPorUbicacion] = useState<
    Record<string, number>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferenciaStockSchemaType>({
    resolver: zodResolver(transferenciaStockSchema),
  });

  const itemId = watch("item_id");
  const origenId = watch("deposito_origen_id");
  const destinoId = watch("deposito_destino_id");

  const fetchData = useCallback(() => {
    setIsLoading(true);
    Promise.all([
      getUbicacionesActivas(),
      getStockItemsActivos(),
      getUltimasTransferenciasStock(),
    ])
      .then(([ubicacionesData, itemsData, transferData]) => {
        setUbicaciones(ubicacionesData);
        setItems(itemsData);
        setTransferencias(transferData);
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Error al cargar los datos",
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Existencias del ítem elegido, para mostrar el disponible por ubicación
  useEffect(() => {
    if (!itemId) {
      setStockPorUbicacion({});
      return;
    }
    getStockPorUbicacion(itemId)
      .then(setStockPorUbicacion)
      .catch(() => setStockPorUbicacion({}));
  }, [itemId]);

  const depositos = ubicaciones.filter((u) => u.tipo === "deposito");
  const puntosVenta = ubicaciones.filter((u) => u.tipo === "punto_venta");
  const stockOrigen = origenId ? (stockPorUbicacion[origenId] ?? 0) : null;

  function renderOpciones(excluirId?: string) {
    const grupos = [
      { label: "Depósitos", opciones: depositos },
      { label: "Puntos de Venta", opciones: puntosVenta },
    ];
    return grupos
      .map((g) => ({ ...g, opciones: g.opciones.filter((o) => o.id !== excluirId) }))
      .filter((g) => g.opciones.length > 0)
      .map((g) => (
        <SelectGroup key={g.label}>
          <SelectLabel>{g.label}</SelectLabel>
          {g.opciones.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nombre}
              {itemId ? ` (${stockPorUbicacion[u.id] ?? 0})` : ""}
            </SelectItem>
          ))}
        </SelectGroup>
      ));
  }

  function resetForm() {
    reset({
      item_id: "" as unknown as string,
      deposito_origen_id: "" as unknown as string,
      deposito_destino_id: "" as unknown as string,
      cantidad: undefined as unknown as number,
      motivo: null,
    });
  }

  async function onSubmit(data: TransferenciaStockSchemaType) {
    setIsSubmitting(true);
    try {
      const result = await transferirStock(data);
      toast.success("Transferencia realizada correctamente");
      if (result.warning) toast.warning(result.warning);
      resetForm();
      setStockPorUbicacion({});
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al realizar la transferencia",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transferencias de Stock"
        description="Mover existencias entre depósitos y puntos de venta, en cualquier dirección."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nueva Transferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label>Ítem</Label>
                <Select
                  value={itemId || ""}
                  onValueChange={(v) => setValue("item_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar ítem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.nombre} ({i.unidad})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.item_id && (
                  <p className="text-xs text-destructive">{errors.item_id.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ubicación Origen</Label>
                <Select
                  value={origenId || ""}
                  onValueChange={(v) => {
                    setValue("deposito_origen_id", v);
                    if (v === destinoId) {
                      setValue("deposito_destino_id", "" as unknown as string);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar origen..." />
                  </SelectTrigger>
                  <SelectContent>{renderOpciones()}</SelectContent>
                </Select>
                {errors.deposito_origen_id && (
                  <p className="text-xs text-destructive">
                    {errors.deposito_origen_id.message}
                  </p>
                )}
                {stockOrigen !== null && (
                  <p
                    className={
                      stockOrigen <= 0
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    Stock disponible en origen: {stockOrigen}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ubicación Destino</Label>
                <Select
                  value={destinoId || ""}
                  onValueChange={(v) => setValue("deposito_destino_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar destino..." />
                  </SelectTrigger>
                  <SelectContent>{renderOpciones(origenId)}</SelectContent>
                </Select>
                {errors.deposito_destino_id && (
                  <p className="text-xs text-destructive">
                    {errors.deposito_destino_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  step="1"
                  {...register("cantidad", { valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.cantidad && (
                  <p className="text-xs text-destructive">
                    {errors.cantidad.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="motivo">Motivo</Label>
                <Input
                  id="motivo"
                  {...register("motivo")}
                  placeholder="Motivo de la transferencia..."
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Realizar Transferencia
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Últimas transferencias */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas Transferencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : transferencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Sin transferencias registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transferencias.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.created_at)}</TableCell>
                        <TableCell>{t.item?.nombre ?? "—"}</TableCell>
                        <TableCell>{t.deposito?.nombre ?? "—"}</TableCell>
                        <TableCell>{t.deposito_destino?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {t.cantidad}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
