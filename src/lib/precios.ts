/**
 * Espejo del `DEFAULT 20` de `configuracion.recargo_no_socio_pct`.
 *
 * Es el valor al que degrada la UI si la configuración no se puede leer, y
 * coincide con el `VentaDefault = 20` que traía el sistema legacy.
 */
export const RECARGO_NO_SOCIO_FALLBACK = 20;

/**
 * Tarifa de no socio sugerida: la de socio más `pct` por ciento.
 *
 * Misma cuenta que `recalcular_precios_no_socio` en la base
 * (`round(precio * (1 + pct / 100), 2)`), pero hecha en **centavos enteros** y
 * no como `Number((precio * factor).toFixed(2))`. La diferencia importa: con
 * `precio = 1.15` y `pct = 50`, `1.15 * 1.5` da 1.7249999999999999 en binario
 * y `toFixed` baja a 1.72, mientras Postgres —numeric exacto, redondeo
 * half-away-from-zero— escribe 1.73. El formulario estaría sugiriendo un
 * centavo menos de lo que después le pisa la reconstrucción masiva.
 *
 * `precio` es NUMERIC(12,2) y `pct` NUMERIC(5,2), así que los dos `Math.round`
 * de entrada son exactos para cualquier valor que la base pueda guardar, y con
 * precios realistas el producto queda muy por debajo de MAX_SAFE_INTEGER.
 */
export function precioNoSocioSugerido(precio: number, pct: number): number {
  const centavos = Math.round(precio * 100);
  const puntos = Math.round(pct * 100);
  return Math.round((centavos * (10000 + puntos)) / 10000) / 100;
}
