import { z } from "zod";

export const categoriaMovimientoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  tipo: z.enum(["ingreso", "egreso"], { message: "Seleccione un tipo" }),
  activa: z.boolean(),
});

export type CategoriaMovimientoSchemaType = z.infer<typeof categoriaMovimientoSchema>;

export const cajaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  saldo_inicial: z.number().min(0, "El saldo inicial debe ser mayor o igual a 0"),
  activa: z.boolean(),
});

export type CajaSchemaType = z.infer<typeof cajaSchema>;

export const movimientoSchema = z.object({
  tipo: z.enum(["ingreso", "egreso"], { message: "Seleccione un tipo" }),
  caja_id: z.string().uuid("Seleccione una caja"),
  categoria_id: z.string().uuid("Seleccione una categoría"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  descripcion: z.string().nullable().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
});

export type MovimientoSchemaType = z.infer<typeof movimientoSchema>;

export const transferenciaSchema = z.object({
  caja_origen_id: z.string().uuid("Seleccione caja origen"),
  caja_destino_id: z.string().uuid("Seleccione caja destino"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  descripcion: z.string().nullable().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
});

export type TransferenciaSchemaType = z.infer<typeof transferenciaSchema>;
