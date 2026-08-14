import "server-only";
import type { ApiMeta } from "./response";

type ConTotal = { total_filas?: number | string | null };
type RespuestaRpc<T> = { data: T[] | null; error: { message?: string } | null };

/**
 * Las RPCs de listado devuelven `total_filas` repetido en cada fila (viene de
 * un `count(*) OVER ()`, que resuelve la paginación en una sola query en vez
 * de dos). Acá se lo saca del payload y se lo mueve al `meta`, que es donde la
 * app lo espera: repetirlo en cada elemento sería ruido en la respuesta.
 */
function separarTotal<T extends ConTotal>(filas: T[]): {
  data: Omit<T, "total_filas">[];
  total: number | null;
} {
  // Sin filas no hay `total_filas` que leer, y eso NO significa total 0: puede
  // ser una página más allá del final. Se devuelve null para que el llamador
  // decida si hace falta recontar.
  const total = filas.length > 0 ? Number(filas[0].total_filas ?? 0) : null;
  const data = filas.map((fila) => {
    const copia = { ...fila };
    delete copia.total_filas;
    return copia;
  });
  return { data, total };
}

/** Convierte page/per_page (1-based, como los ve la app) al offset que espera la RPC. */
export function offsetDe(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

/**
 * Ejecuta una RPC paginada y arma `{ data, meta }`.
 *
 * El detalle que justifica el helper: si la página pedida cae más allá del
 * final, la RPC devuelve cero filas y con ellas se pierde el `count(*) OVER ()`.
 * Reportar `total: 0` ahí sería mentir — le diría a la app "no tenés ninguna
 * cuota" cuando en realidad se pasó de página, y cualquier paginador construido
 * sobre `meta.total` colapsaría. En ese caso —y sólo en ése— se hace una
 * segunda llamada mínima (`limit 1, offset 0`) para recuperar el total real.
 */
export async function listarPaginado<T extends ConTotal>(
  llamar: (limit: number, offset: number) => PromiseLike<RespuestaRpc<T>>,
  page: number,
  perPage: number,
): Promise<
  | { ok: true; data: Omit<T, "total_filas">[]; meta: ApiMeta }
  | { ok: false; error: { message?: string } }
> {
  const res = await llamar(perPage, offsetDe(page, perPage));
  if (res.error) return { ok: false, error: res.error };

  const { data, total } = separarTotal(res.data ?? []);

  let totalFinal = total;
  if (totalFinal === null) {
    if (page === 1) {
      // Primera página vacía: no hay nada, y el total es genuinamente 0.
      totalFinal = 0;
    } else {
      const recuento = await llamar(1, 0);
      if (recuento.error) return { ok: false, error: recuento.error };
      const primera = (recuento.data ?? [])[0];
      totalFinal = primera ? Number(primera.total_filas ?? 0) : 0;
    }
  }

  return { ok: true, data, meta: { page, per_page: perPage, total: totalFinal } };
}
