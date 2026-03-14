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
import { Loader2 } from "lucide-react";
import { movimientoSchema, type MovimientoSchemaType } from "@/lib/schemas/tesoreria";
import { formatCurrency } from "@/lib/format";
import {
  getCajasActivas,
  getCategoriasActivas,
  ingresarMovimiento,
} from "./actions";
import type { Caja, CategoriaMovimiento } from "@/types/tesoreria";

export default function NuevoMovimientoPage() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimiento[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MovimientoSchemaType>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: {
      tipo: "ingreso",
      fecha: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const tipoValue = watch("tipo");
  const cajaIdValue = watch("caja_id");
  const categoriaIdValue = watch("categoria_id");

  useEffect(() => {
    Promise.all([getCajasActivas(), getCategoriasActivas()]).then(
      ([cajasData, categoriasData]) => {
        setCajas(cajasData);
        setCategorias(categoriasData);
      },
    );
  }, []);

  // Filter categories by selected tipo
  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipoValue);

  // Reset categoria when tipo changes
  useEffect(() => {
    setValue("categoria_id", "" as unknown as string);
  }, [tipoValue, setValue]);

  function resetForm() {
    reset({
      tipo: "ingreso",
      caja_id: "" as unknown as string,
      categoria_id: "" as unknown as string,
      monto: undefined as unknown as number,
      descripcion: null,
      fecha: format(new Date(), "yyyy-MM-dd"),
    });
  }

  async function onSubmit(data: MovimientoSchemaType) {
    setIsSubmitting(true);
    try {
      const result = await ingresarMovimiento(data);
      const cajaName =
        cajas.find((c) => c.id === data.caja_id)?.nombre ?? "la caja";
      toast.success(
        `Movimiento registrado. Nuevo saldo de ${cajaName}: ${formatCurrency(result.nuevoSaldo)}`,
        {
          action: {
            label: "Registrar otro",
            onClick: resetForm,
          },
          duration: 8000,
        },
      );
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
        title="Ingresar Movimiento"
        description="Registrar un nuevo movimiento de fondos"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos del Movimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
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
                    <p className="text-xs text-red-500">{errors.tipo.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Caja</Label>
                  <Select
                    value={cajaIdValue || ""}
                    onValueChange={(v) => setValue("caja_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar caja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cajas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.caja_id && (
                    <p className="text-xs text-red-500">
                      {errors.caja_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select
                    value={categoriaIdValue || ""}
                    onValueChange={(v) => setValue("categoria_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasFiltradas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoria_id && (
                    <p className="text-xs text-red-500">
                      {errors.categoria_id.message}
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
                    <p className="text-xs text-red-500">
                      {errors.monto.message}
                    </p>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Input
                    id="descripcion"
                    {...register("descripcion")}
                    placeholder="Descripción del movimiento..."
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    {...register("fecha")}
                  />
                  {errors.fecha && (
                    <p className="text-xs text-red-500">
                      {errors.fecha.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Registrar Movimiento
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
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
