import { z } from "zod";

export const depositoSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido"),
    descripcion: z.string().nullable().optional(),
    activo: z.boolean(),
    tipo: z.enum(["deposito", "punto_venta"], {
      message: "Seleccione un tipo de ubicación",
    }),
    caja_id: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.tipo === "punto_venta" || !data.caja_id, {
    message: "Solo los puntos de venta pueden tener una caja asociada",
    path: ["caja_id"],
  });

export type DepositoSchemaType = z.infer<typeof depositoSchema>;

export const stockItemSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido"),
    descripcion: z.string().nullable().optional(),
    unidad: z.string().min(1, "Unidad requerida"),
    activo: z.boolean(),
    stock_inicial: z.number().int().min(0).optional(),
    deposito_id: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !data.stock_inicial || !!data.deposito_id, {
    message: "Seleccione la ubicación donde se acredita el stock inicial",
    path: ["deposito_id"],
  });

export type StockItemSchemaType = z.infer<typeof stockItemSchema>;

export const transferenciaStockSchema = z
  .object({
    item_id: z.string().uuid("Seleccione un ítem"),
    deposito_origen_id: z.string().uuid("Seleccione la ubicación origen"),
    deposito_destino_id: z.string().uuid("Seleccione la ubicación destino"),
    cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
    motivo: z.string().nullable().optional(),
  })
  .refine((data) => data.deposito_origen_id !== data.deposito_destino_id, {
    message: "El origen y el destino deben ser diferentes",
    path: ["deposito_destino_id"],
  });

export type TransferenciaStockSchemaType = z.infer<
  typeof transferenciaStockSchema
>;

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
