/** Tope de filas que PostgREST devuelve por request (default de Supabase Cloud). */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Trae TODAS las filas paginando de a `SUPABASE_PAGE_SIZE`.
 *
 * Un `.select()` sin `.range()` se corta en 1000 filas en silencio: no falla,
 * simplemente devuelve menos datos de los que hay. Para los catálogos que
 * alimentan un combo eso significa esconder ítems que sí existen.
 *
 * Ordenar por una columna no única (p. ej. `nombre`) puede duplicar o saltear
 * filas entre páginas, así que agregar siempre un desempate estable:
 * `.order("nombre").order("id")`.
 *
 * Avanza por la cantidad de filas que el servidor devolvió y corta recién con una
 * página vacía, en vez de asumir que `max-rows` es exactamente `SUPABASE_PAGE_SIZE`:
 * si el proyecto tuviera un tope menor, cortar por "página incompleta" reintroduciría
 * el truncamiento que este helper existe para evitar. Cuesta un request extra al final.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(
      rows.length,
      rows.length + SUPABASE_PAGE_SIZE - 1,
    );
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}
