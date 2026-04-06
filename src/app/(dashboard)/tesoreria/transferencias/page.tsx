"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { transferenciaSchema, type TransferenciaSchemaType } from "@/lib/schemas/tesoreria";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCajasConSaldo,
  realizarTransferencia,
  getUltimasTransferencias,
} from "./actions";
import type { Caja, MovimientoFondo } from "@/types/tesoreria";

export default function TransferenciasPage() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [transferencias, setTransferencias] = useState<MovimientoFondo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferenciaSchemaType>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      fecha: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const origenId = watch("caja_origen_id");
  const destinoId = watch("caja_destino_id");

  function fetchData() {
    setIsLoading(true);
    Promise.all([getCajasConSaldo(), getUltimasTransferencias()])
      .then(([cajasData, transferData]) => {
        setCajas(cajasData);
        setTransferencias(transferData);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  const cajaOrigen = cajas.find((c) => c.id === origenId);
  const cajasDestino = cajas.filter((c) => c.id !== origenId);

  function resetForm() {
    reset({
      caja_origen_id: "" as unknown as string,
      caja_destino_id: "" as unknown as string,
      monto: undefined as unknown as number,
      descripcion: null,
      fecha: format(new Date(), "yyyy-MM-dd"),
    });
  }

  async function onSubmit(data: TransferenciaSchemaType) {
    if (data.caja_origen_id === data.caja_destino_id) {
      toast.error("La caja origen y destino deben ser diferentes");
      return;
    }

    const origen = cajas.find((c) => c.id === data.caja_origen_id);
    if (origen && data.monto > (origen.saldo_actual ?? 0)) {
      toast.error(
        `Saldo insuficiente. Saldo disponible: ${formatCurrency(origen.saldo_actual ?? 0)}`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await realizarTransferencia(data);
      toast.success("Transferencia realizada correctamente");
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al realizar transferencia",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Transferencias entre Cajas" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nueva Transferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label>Caja Origen</Label>
                <Select
                  value={origenId || ""}
                  onValueChange={(v) => {
                    setValue("caja_origen_id", v);
                    // Reset destino if same
                    if (v === destinoId) {
                      setValue("caja_destino_id", "" as unknown as string);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar caja origen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cajas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} ({formatCurrency(c.saldo_actual ?? 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.caja_origen_id && (
                  <p className="text-xs text-red-500">
                    {errors.caja_origen_id.message}
                  </p>
                )}
                {cajaOrigen && (
                  <p className="text-xs text-muted-foreground">
                    Saldo disponible: {formatCurrency(cajaOrigen.saldo_actual ?? 0)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Caja Destino</Label>
                <Select
                  value={destinoId || ""}
                  onValueChange={(v) => setValue("caja_destino_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar caja destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cajasDestino.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.caja_destino_id && (
                  <p className="text-xs text-red-500">
                    {errors.caja_destino_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="monto">Monto ($)</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  {...register("monto", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {errors.monto && (
                  <p className="text-xs text-red-500">{errors.monto.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  {...register("descripcion")}
                  placeholder="Motivo de la transferencia..."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fecha">Fecha</Label>
                <Input id="fecha" type="date" {...register("fecha")} />
                {errors.fecha && (
                  <p className="text-xs text-red-500">{errors.fecha.message}</p>
                )}
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

        {/* Recent transfers */}
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
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : transferencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        Sin transferencias registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transferencias.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.fecha)}</TableCell>
                        <TableCell>{t.caja?.nombre ?? "—"}</TableCell>
                        <TableCell>{t.caja_destino?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(t.monto))}
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
