"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, TriangleAlert } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { emitirCodigosMasivo, getSociosParaEmision } from "../actions";
import { getCategoriasSociales } from "@/app/(dashboard)/socios/config/categorias/actions";
import type { CandidatoEmision, CodigoEmitido } from "@/types/app-movil";

const MAX_LOTE = 1000;

export default function EmisionMasivaPage() {
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [categoriaId, setCategoriaId] = useState("todas");
  const [candidatos, setCandidatos] = useState<CandidatoEmision[]>([]);
  // Total real de candidatos, que puede superar el tope del lote. Sin este dato
  // la pantalla decía "se emitirán N" sin ninguna señal de cuántos quedaban afuera.
  const [totalCandidatos, setTotalCandidatos] = useState(0);
  const [emitidos, setEmitidos] = useState<CodigoEmitido[]>([]);
  const [cargando, setCargando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);

  useEffect(() => {
    getCategoriasSociales()
      .then((cs) => setCategorias(cs.map((c) => ({ id: c.id, nombre: c.nombre }))))
      .catch(() => toast.error("No se pudieron cargar las categorías"));
  }, []);

  // OJO: esta función NO puede limpiar `emitidos`. `emitir()` la llama al
  // terminar para refrescar el conteo de candidatos, y si acá se hiciera
  // setEmitidos([]) el último write ganaría y borraría los códigos recién
  // emitidos — que sólo existen en claro en ese estado de React, porque la
  // base guarda únicamente sus hashes. Serían irrecuperables: la única salida
  // sería reemitir, revocando otra vez los que el operador ya repartió.
  // El limpiado ocurre al cambiar de lote (ver onValueChange del Select).
  const previsualizar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await getSociosParaEmision(
        categoriaId === "todas" ? undefined : categoriaId,
      );
      setCandidatos(res.data);
      setTotalCandidatos(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo calcular el lote");
    } finally {
      setCargando(false);
    }
  }, [categoriaId]);

  useEffect(() => {
    previsualizar();
  }, [previsualizar]);

  async function emitir() {
    setEmitiendo(true);
    try {
      const res = await emitirCodigosMasivo(candidatos.map((c) => c.socio_id));
      // ACUMULA, no reemplaza. Con más de MAX_LOTE candidatos el banner le pide
      // al operador que repita la operación, y `previsualizar()` rehabilita el
      // botón con la tanda siguiente: si esto reemplazara, el segundo click
      // borraría los códigos del primero — que ya están vivos en la base y de
      // los que sólo se guarda el hash. La lista es "todo lo que emitiste y
      // todavía no descargaste", y el Excel se baja una sola vez al final.
      setEmitidos((prev) => [...prev, ...res]);
      if (res.length === 0) {
        toast.info("No se emitió ningún código: los socios del lote ya tienen cuenta.");
      } else {
        toast.success(`${res.length} código(s) emitido(s). Descargue el Excel.`);
      }
      await previsualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo emitir el lote");
    } finally {
      setEmitiendo(false);
    }
  }

  async function descargar() {
    await exportToExcel(
      emitidos as unknown as Record<string, unknown>[],
      `codigos_app_movil_${new Date().toISOString().slice(0, 10)}`,
      "Códigos",
      [
        { key: "nro_socio", label: "Nro Socio" },
        { key: "apellido", label: "Apellido" },
        { key: "nombre", label: "Nombre" },
        { key: "codigo", label: "Código" },
        { key: "expira_at", label: "Vence" },
      ],
    );
  }

  // La RPC ya limita el lote a MAX_LOTE, así que esto no es una condición de
  // error sino un aviso de que quedan candidatos para una tanda siguiente.
  const hayResto = totalCandidatos > candidatos.length;
  const vencidos = candidatos.filter((c) => c.vencido).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Emisión masiva de códigos"
        description="Genera un código de activación para cada socio que todavía no tiene cuenta ni código vigente."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Elegir el lote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Cambiar de categoría NO descarta los códigos ya emitidos: son
                códigos reales que nadie descargó todavía, y hacer que un click
                en un <Select> los destruya en silencio es la misma pérdida de
                datos por otra puerta. Se acumulan y se descartan sólo con el
                botón explícito de abajo. */}
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={previsualizar} disabled={cargando}>
              {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Recalcular
            </Button>
          </div>

          <p className="text-sm">
            {cargando ? (
              "Calculando…"
            ) : (
              <>
                Se emitirán códigos para{" "}
                <span className="font-bold">{candidatos.length}</span> socio(s)
                {vencidos > 0 ? (
                  <>
                    {" "}
                    (<span className="font-bold">{vencidos}</span> ya tenían un
                    código vencido, que se reemplaza)
                  </>
                ) : null}
                .
              </>
            )}
          </p>

          {hayResto ? (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Hay <span className="font-bold">{totalCandidatos}</span> socios
                sin código, más de los {MAX_LOTE} que se pueden emitir de una
                vez: un lote más grande se cortaría a la mitad y dejaría códigos
                emitidos que nadie recibió. Se emitirán los primeros{" "}
                {candidatos.length}; repita la operación (o filtre por categoría)
                para cubrir los {totalCandidatos - candidatos.length} restantes.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Emitir y descargar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={emitir}
              disabled={emitiendo || cargando || candidatos.length === 0}
            >
              {emitiendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Emitir {candidatos.length} código(s)
            </Button>
            <Button
              variant="outline"
              onClick={descargar}
              disabled={emitidos.length === 0}
            >
              Descargar Excel ({emitidos.length})
            </Button>
            {emitidos.length > 0 ? (
              <Button variant="ghost" onClick={() => setConfirmarLimpiar(true)}>
                Limpiar lista
              </Button>
            ) : null}
          </div>

          {emitidos.length > 0 ? (
            <>
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Descargue el Excel ahora: los códigos no se guardan y no se
                  pueden volver a ver. Si sale de esta pantalla o recarga habrá
                  que reemitirlos. La lista acumula todas las tandas emitidas
                  hasta que descargue o la limpie.
                </p>
              </div>
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Nro</th>
                      <th className="px-3 py-2 text-left">Socio</th>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emitidos.map((e) => (
                      <tr key={e.socio_id} className="border-t">
                        <td className="px-3 py-1.5">{e.nro_socio}</td>
                        <td className="px-3 py-1.5">
                          {e.apellido}, {e.nombre}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{e.codigo}</td>
                        <td className="px-3 py-1.5">{formatDate(e.expira_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmarLimpiar} onOpenChange={setConfirmarLimpiar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Descartar {emitidos.length} código(s) de la pantalla?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Los códigos siguen activos para los socios, pero no vas a poder
              volver a verlos ni descargarlos: para entregarlos habría que
              reemitirlos, lo que invalida estos. Si todavía no bajaste el
              Excel, hacelo antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEmitidos([])}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
