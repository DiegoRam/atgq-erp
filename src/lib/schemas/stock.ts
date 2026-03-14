import { z } from "zod";

export const depositoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean(),
});

export type DepositoSchemaType = z.infer<typeof depositoSchema>;

export const stockItemSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  unidad: z.string().min(1, "Unidad requerida"),
  activo: z.boolean(),
  stock_inicial: z.number().int().min(0).optional(),
});

export type StockItemSchemaType = z.infer<typeof stockItemSchema>;

export const movimientoStockSchema = z
  .object({
    tipo: z.enum(["ingreso", "egreso"], { message: "Seleccione un tipo" }),
    deposito_id: z.string().uuid("Seleccione un depósito"),
    item_id: z.string().uuid("Seleccione un ítem"),
    cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
    motivo: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.tipo === "egreso") {
        return !!data.motivo && data.motivo.trim().length > 0;
      }
      return true;
    },
    {
      message: "El motivo es requerido para egresos",
      path: ["motivo"],
    },
  );

export type MovimientoStockSchemaType = z.infer<typeof movimientoStockSchema>;
