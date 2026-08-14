"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CodigoEmitido } from "@/types/app-movil";

/**
 * Muestra el código recién emitido.
 *
 * Es la única pantalla del sistema donde el código aparece en claro: la base
 * guarda sólo su hash. De ahí la advertencia — si el operador cierra sin
 * copiarlo, la única salida es reemitir (lo que invalida el anterior).
 */
export function CodigoEmitidoDialog({
  codigo,
  onClose,
}: {
  codigo: CodigoEmitido | null;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Dialog
      open={!!codigo}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setCopiado(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Código de activación</DialogTitle>
          <DialogDescription>
            {codigo
              ? `${codigo.apellido}, ${codigo.nombre} — socio N.º ${codigo.nro_socio}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed bg-muted/40 px-4 py-6 text-center">
            <p className="select-all font-mono text-3xl font-bold tracking-widest">
              {codigo?.codigo}
            </p>
            {codigo?.expira_at ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Vence el {formatDate(codigo.expira_at)}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Anote o copie el código antes de cerrar: por seguridad no se guarda
              y no se puede volver a ver. Si se pierde, hay que emitir uno nuevo.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={copiar}>
            {copiado ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copiado
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </>
            )}
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
