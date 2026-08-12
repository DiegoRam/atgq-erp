"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { formatCurrency, formatPorcentaje } from "@/lib/format";
import {
  previewRecalculoNoSocio,
  ejecutarRecalculoNoSocio,
} from "@/app/(dashboard)/security/configuracion/actions";
import type { RecalculoResultado } from "@/types/configuracion";

interface RecalculoNoSocioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama tras aplicar, para refrescar la marca de última corrida */
  onApplied: () => void;
}

export function RecalculoNoSocioDialog({
  open,
  onOpenChange,
  onApplied,
}: RecalculoNoSocioDialogProps) {
  const [preview, setPreview] = useState<RecalculoResultado | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: err } = await previewRecalculoNoSocio();
    if (err) {
      setError(err);
      setPreview(null);
    } else {
      setPreview(data ?? null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      cargarPreview();
    } else {
      // El Dialog de Radix desmonta su contenido pero no este componente: sin
      // esto, la próxima apertura mostraría el preview viejo mientras carga.
      setPreview(null);
      setError(null);
    }
  }, [open, cargarPreview]);

  async function handleConfirmar() {
    if (!preview) return;
    setIsApplying(true);
    try {
      // Se manda el pct que se previsualizó: si otro admin lo cambió mientras
      // esta pantalla mostraba el preview, el RPC aborta en vez de escribir
      // números que nadie revisó.
      const { data, error: err } = await ejecutarRecalculoNoSocio(preview.pct);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(
        `${data?.afectados ?? 0} ítems actualizados al ${formatPorcentaje(data?.pct ?? 0)}%`,
      );
      onApplied();
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  }

  const sinCambios = preview !== null && preview.afectados === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // No dejar cerrar a mitad de la escritura.
        if (isApplying) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reconstruir precios de no socio</DialogTitle>
          <DialogDescription>
            Revise el impacto antes de aplicar. Todavía no se modificó nada.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando impacto...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {preview && !isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Resumen label="Recargo" valor={`${formatPorcentaje(preview.pct)}%`} />
              <Resumen label="Catálogo" valor={String(preview.total)} />
              <Resumen label="Cambian" valor={String(preview.afectados)} destacado />
              <Resumen
                label="Sin cambios"
                valor={String(preview.total - preview.afectados)}
              />
            </div>

            {(preview.a_cero > 0 || preview.con_nombre_socio > 0) && (
              <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  Revise estos casos antes de aplicar
                </p>
                {preview.a_cero > 0 && (
                  <p className="text-muted-foreground">
                    <strong>{preview.a_cero}</strong>{" "}
                    {preview.a_cero === 1 ? "ítem tiene" : "ítems tienen"} precio de
                    socio en $0 y quedarán también en $0 para no socios, perdiendo
                    su tarifa actual.
                  </p>
                )}
                {preview.con_nombre_socio > 0 && (
                  <p className="text-muted-foreground">
                    <strong>{preview.con_nombre_socio}</strong>{" "}
                    {preview.con_nombre_socio === 1
                      ? "ítem menciona"
                      : "ítems mencionan"}{" "}
                    &quot;socio&quot; en el nombre. Si son pares del tipo
                    &quot;Permiso de Caza - Socio&quot; / &quot;- No Socio&quot;,
                    el recargo se les aplicaría por segunda vez; revíselos. El
                    conteo es amplio a propósito e incluye ítems que sólo nombran
                    a los socios (ej. &quot;Llave sala de socios&quot;).
                  </p>
                )}
              </div>
            )}

            {sinCambios ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todos los ítems ya están al {formatPorcentaje(preview.pct)}%. No hay
                nada que recalcular.
              </p>
            ) : (
              <div>
                <ScrollArea className="h-[280px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ítem</TableHead>
                        <TableHead className="text-right">Socio</TableHead>
                        <TableHead className="text-right">No socio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.muestra.map((row, i) => (
                        <TableRow key={`${row.nombre}-${i}`}>
                          <TableCell className="font-medium">{row.nombre}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.precio)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="text-muted-foreground line-through">
                              {formatCurrency(row.actual)}
                            </span>
                            <ArrowRight className="mx-1 inline h-3 w-3 text-muted-foreground" />
                            <span
                              className={
                                row.nuevo >= row.actual
                                  ? "font-medium text-emerald-600 dark:text-emerald-500"
                                  : "font-medium text-destructive"
                              }
                            >
                              {formatCurrency(row.nuevo)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {preview.afectados > preview.muestra.length && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mostrando {preview.muestra.length} de {preview.afectados} ítems,
                    ordenados por magnitud del cambio. Se aplicará a todos.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={isLoading || isApplying || sinCambios || !preview}
          >
            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isApplying ? "Aplicando..." : "Confirmar y aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumen({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${destacado ? "text-primary" : ""}`}
      >
        {valor}
      </p>
    </div>
  );
}
