"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDate, formatPorcentaje } from "@/lib/format";
import {
  configuracionSchema,
  type ConfiguracionSchemaType,
} from "@/lib/schemas/configuracion";
import { getConfiguracion, updateConfiguracion } from "./actions";
import { RecalculoNoSocioDialog } from "@/components/security/RecalculoNoSocioDialog";
import type { Configuracion } from "@/types/configuracion";

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recalculoOpen, setRecalculoOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfiguracionSchemaType>({
    resolver: zodResolver(configuracionSchema),
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await getConfiguracion();
      if (error || !data) {
        const msg = error ?? "Error al cargar la configuración";
        // Se guarda además del toast: sin esto la tarjeta de reconstrucción
        // quedaba afirmando "Nunca se ejecutó" y con el botón destructivo
        // habilitado (isDirty es false porque reset() nunca corrió), o sea que
        // un fallo de carga se veía igual que una configuración sana.
        setLoadError(msg);
        setConfig(null);
        toast.error(msg);
        return;
      }
      setConfig(data);
      setLoadError(null);
      // reset() y no defaultValues: es lo que además pone isDirty en false
      // después de guardar o de recalcular.
      reset({ recargo_no_socio_pct: data.recargo_no_socio_pct });
    } finally {
      setIsLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function onSubmit(data: ConfiguracionSchemaType) {
    setIsSubmitting(true);
    try {
      const { error } = await updateConfiguracion(data);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Configuración guardada");
      await fetchData();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parámetros del Sistema"
        description="Configuración global del club."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recargo para no socios</CardTitle>
          <CardDescription>
            Porcentaje que se suma al precio de socio para calcular la tarifa de no
            socio. Se aplica al dar de alta o editar ítems de venta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : loadError ? (
            <ErrorCarga mensaje={loadError} onRetry={fetchData} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="recargo_no_socio_pct">Recargo (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="recargo_no_socio_pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="200"
                    className="w-40"
                    {...register("recargo_no_socio_pct", { valueAsNumber: true })}
                  />
                  <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Guardar
                  </Button>
                </div>
                {errors.recargo_no_socio_pct && (
                  <p className="text-xs text-destructive">
                    {errors.recargo_no_socio_pct.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Un recargo de 0 significa que el no socio paga la misma tarifa que
                  el socio.
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconstrucción de precios</CardTitle>
          <CardDescription>
            Recalcula la tarifa de no socio de <strong>todos</strong> los ítems de
            venta a partir del precio de socio y el recargo configurado. Alcanza a
            los ítems inactivos y pisa las tarifas cargadas a mano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : !config ? (
            <p className="text-sm text-muted-foreground">
              No se pudo leer la configuración, así que no se puede recalcular.
              Reintente arriba.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {config?.recargo_aplicado_at ? (
                  <>
                    Última corrida: {formatDate(config.recargo_aplicado_at)} —{" "}
                    {config.recargo_aplicado_items ?? 0} ítems actualizados.
                  </>
                ) : (
                  "Nunca se ejecutó."
                )}
              </p>
              <div>
                <Button
                  variant="destructive"
                  onClick={() => setRecalculoOpen(true)}
                  disabled={isDirty}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalcular todos los ítems
                </Button>
                {/*
                  El recálculo lee el porcentaje de la base, no del input: con
                  cambios sin guardar el preview no se correspondería con lo que
                  el operador está mirando en pantalla.
                */}
                {isDirty && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Guarde el porcentaje antes de recalcular.
                  </p>
                )}
                {!isDirty && config && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Se aplicará el {formatPorcentaje(config.recargo_no_socio_pct)}%
                    configurado. Verá una previsualización antes de confirmar.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <RecalculoNoSocioDialog
        open={recalculoOpen}
        onOpenChange={setRecalculoOpen}
        onApplied={fetchData}
      />
    </div>
  );
}

function ErrorCarga({
  mensaje,
  onRetry,
}: {
  mensaje: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
      <p className="text-sm text-destructive">{mensaje}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
