import { z } from "zod";

/**
 * El rango replica el CHECK de la columna (`>= 0 AND <= 200`): 0 es válido y
 * significa "el no socio paga la tarifa de socio", y el tope de 200 es un
 * guard de fat-finger.
 *
 * Sin `.multipleOf(0.01)` para los dos decimales: sobre floats es una trampa
 * (0.29 % falla). El redondeo lo hace la server action antes de escribir y lo
 * sella el tipo NUMERIC(5,2) de la columna.
 */
export const configuracionSchema = z.object({
  recargo_no_socio_pct: z
    .number({ error: "Ingrese el porcentaje de recargo" })
    .min(0, "El recargo no puede ser negativo")
    .max(200, "El recargo no puede superar el 200%"),
});

export type ConfiguracionSchemaType = z.infer<typeof configuracionSchema>;
