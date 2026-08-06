import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type TipoUbicacion = "deposito" | "punto_venta";

/**
 * Los errores se **devuelven**, no se tiran: en un build de producción Next
 * redacta el mensaje de cualquier Error que escape de un server action y el
 * cliente recibe "An error occurred in the Server Components render...".
 * Devolverlo es lo único que hace llegar el motivo real al usuario, y es la
 * convención que ya usa `src/app/login/actions.ts`.
 */
export type ResultadoBorrado = { error?: string };

/**
 * Depósitos y puntos de venta son la misma tabla `depositos` (discriminada por
 * `tipo`), así que el borrado comparte chequeos: sólo cambian las etiquetas.
 * Módulo plano —sin "use server"— para que no quede expuesto como endpoint:
 * lo llaman los `actions.ts` de cada ruta.
 */
const ETIQUETA: Record<TipoUbicacion, string> = {
  deposito: "el depósito",
  punto_venta: "el punto de venta",
};

/**
 * Los conteos se hacen con el cliente del usuario, así que RLS puede ocultar
 * filas de otro módulo (p.ej. un rol con `stock.eliminar` pero sin `ventas.leer`)
 * y devolver 0 sin error. Se falla cerrado ante un `count` nulo, y el FK 23503
 * queda como red final: sólo se pierde el mensaje detallado, nunca la integridad.
 */
function bloquea(count: number | null): boolean {
  return count === null || count > 0;
}

/**
 * Borra un depósito o punto de venta. Todas las FKs entrantes son NO ACTION, así
 * que el borrado con historial fallaría con 23503: se chequea antes para poder
 * dar un mensaje entendible y sugerir la desactivación.
 */
export async function deleteUbicacion(
  supabase: SupabaseServerClient,
  id: string,
  tipo: TipoUbicacion,
): Promise<ResultadoBorrado> {
  const etiqueta = ETIQUETA[tipo];

  // Primero se resuelve la fila acotada por `tipo`: sin esto, el ABM de
  // depósitos podría llegar a tocar los datos de un punto de venta (y viceversa)
  // pasándole un id de la otra pantalla.
  const { data: ubicacion, error: ubicacionError } = await supabase
    .from("depositos")
    .select("id")
    .eq("id", id)
    .eq("tipo", tipo)
    .maybeSingle();
  if (ubicacionError) {
    console.error("deleteUbicacion/select", ubicacionError);
    return { error: ubicacionError.message };
  }
  if (!ubicacion) {
    return { error: `No se encontró ${etiqueta} que se quiere eliminar.` };
  }

  const { count: ventasCount, error: ventasError } = await supabase
    .from("ventas")
    .select("*", { count: "exact", head: true })
    .eq("punto_venta_id", id);
  if (ventasError) {
    console.error("deleteUbicacion/ventas", ventasError);
    return { error: ventasError.message };
  }
  if (bloquea(ventasCount)) {
    return {
      error: `No se puede eliminar ${etiqueta}: tiene ventas registradas. Desactívelo en su lugar.`,
    };
  }

  // Dos consultas con `.eq()` en vez de un `.or()` interpolado: supabase-js
  // codifica los valores de `.eq()`, el contenido de `.or()` se parsea crudo.
  const { count: movOrigenCount, error: movOrigenError } = await supabase
    .from("movimientos_stock")
    .select("*", { count: "exact", head: true })
    .eq("deposito_id", id);
  if (movOrigenError) {
    console.error("deleteUbicacion/movimientos", movOrigenError);
    return { error: movOrigenError.message };
  }

  const { count: movDestinoCount, error: movDestinoError } = await supabase
    .from("movimientos_stock")
    .select("*", { count: "exact", head: true })
    .eq("deposito_destino_id", id);
  if (movDestinoError) {
    console.error("deleteUbicacion/movimientos-destino", movDestinoError);
    return { error: movDestinoError.message };
  }

  if (bloquea(movOrigenCount) || bloquea(movDestinoCount)) {
    return {
      error: `No se puede eliminar ${etiqueta}: tiene movimientos de stock. Desactívelo en su lugar.`,
    };
  }

  // `stock_inventario.cantidad` no tiene CHECK y los RPC permiten negativos
  // (un negativo es justo la diferencia que contabilidad necesita ver), así que
  // bloquea cualquier cantidad distinta de cero, no sólo las positivas.
  const { count: stockCount, error: stockError } = await supabase
    .from("stock_inventario")
    .select("*", { count: "exact", head: true })
    .eq("deposito_id", id)
    .neq("cantidad", 0);
  if (stockError) {
    console.error("deleteUbicacion/inventario", stockError);
    return { error: stockError.message };
  }
  if (bloquea(stockCount)) {
    return {
      error: `No se puede eliminar ${etiqueta}: tiene ítems en stock. Vacíelo o desactívelo en su lugar.`,
    };
  }

  // Sin movimientos ni existencias, las filas de inventario que quedan están en
  // cero (los RPC hacen upsert y nunca las borran). No aportan información y se
  // recrean solas, así que se limpian para liberar la FK. El `.eq("cantidad", 0)`
  // es la garantía de que una carga concurrente no se pierda acá: los dos
  // borrados no comparten transacción.
  const { error: limpiezaError } = await supabase
    .from("stock_inventario")
    .delete()
    .eq("deposito_id", id)
    .eq("cantidad", 0);
  if (limpiezaError) {
    console.error("deleteUbicacion/limpieza", limpiezaError);
    return { error: limpiezaError.message };
  }

  const { data, error } = await supabase
    .from("depositos")
    .delete()
    .eq("id", id)
    .eq("tipo", tipo)
    .select("id");

  if (error) {
    console.error("deleteUbicacion/delete", error);
    if (error.code === "23503") {
      return {
        error: `No se puede eliminar ${etiqueta}: tiene registros asociados. Desactívelo en su lugar.`,
      };
    }
    return { error: error.message };
  }

  // RLS que deniega no devuelve error: devuelve cero filas.
  if (!data || data.length === 0) {
    return {
      error: `No se pudo eliminar ${etiqueta}: no tiene permisos para eliminarlo.`,
    };
  }

  return {};
}
