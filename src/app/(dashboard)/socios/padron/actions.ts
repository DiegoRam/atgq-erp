"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { PadronRow } from "@/types/socios";

/**
 * El id de categoría llega del Select de la pantalla, pero un valor que no sea
 * uuid hace que Postgres devuelva un 22P02 crudo ("invalid input syntax for
 * type uuid") que la UI muestra tal cual. Validarlo acá lo convierte en un
 * error nuestro antes de salir a la red.
 */
const categoriaIdSchema = z.string().uuid().optional();

/**
 * fetchAllRows y no un .rpc() pelado: PostgREST corta en max_rows (1000)
 * también para las funciones set-returning, y `.range(0, 99999)` se recorta
 * igual. Con ~8.400 socios el padrón contaba, exportaba e imprimía menos de
 * un octavo del club en silencio — y un padrón electoral truncado es falso,
 * no incompleto. El desempate estable vive dentro del RPC.
 */
export async function getPadron(
  categoriaId?: string,
  soloHabilitados = false,
): Promise<PadronRow[]> {
  // `|| undefined` y no `?? undefined`: el Select manda "" para "Todas".
  const categoria = categoriaIdSchema.parse(categoriaId || undefined);
  const supabase = await createClient();
  return fetchAllRows<PadronRow>((desde, hasta) =>
    supabase
      .rpc("get_padron", {
        p_categoria_id: categoria ?? null,
        p_solo_habilitados: soloHabilitados,
      })
      .range(desde, hasta),
  );
}

/**
 * El período de corte del criterio "al día", independiente del listado.
 *
 * La pantalla lo necesita aunque `getPadron` devuelva 0 filas: leerlo de la
 * primera fila hacía que un filtro sin resultados imprimiera "sin cuotas
 * sociales emitidas a la fecha" — una afirmación falsa sobre el club, en una
 * hoja que se firma. `null` significa lo que dice: todavía no se emitió
 * ninguna cuota social.
 */
export async function getPeriodoCorte(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_padron_periodo_corte");
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}
