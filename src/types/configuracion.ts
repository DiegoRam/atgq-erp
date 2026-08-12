/**
 * Fila única (id = 1) de `configuracion`: los parámetros globales del sistema.
 * Réplica moderna de la tabla `Configuracion` del legacy.
 */
export interface Configuracion {
  id: number;
  /** Recargo % sobre la tarifa de socio para calcular la de no socio */
  recargo_no_socio_pct: number;
  /** Última reconstrucción masiva de precios; null si nunca se corrió */
  recargo_aplicado_at: string | null;
  recargo_aplicado_por: string | null;
  recargo_aplicado_items: number | null;
  updated_at: string;
  updated_by: string | null;
}

export interface RecalculoMuestraRow {
  nombre: string;
  /** Tarifa de socio, la base del cálculo */
  precio: number;
  /** Tarifa de no socio actual */
  actual: number;
  /** Tarifa de no socio que quedaría */
  nuevo: number;
}

/** Devuelto por el RPC `recalcular_precios_no_socio`, en preview y ejecución. */
export interface RecalculoResultado {
  /** Porcentaje que efectivamente se aplicó: sale de la base, no del cliente */
  pct: number;
  /** Ítems en el catálogo */
  total: number;
  /** Ítems cuya tarifa de no socio cambia */
  afectados: number;
  /** De los afectados, los que quedan en $0 porque su precio de socio es 0 */
  a_cero: number;
  /** De los afectados, los que ya distinguen socio/no socio en el nombre */
  con_nombre_socio: number;
  /** Hasta 50 filas, las de mayor cambio primero */
  muestra: RecalculoMuestraRow[];
}
