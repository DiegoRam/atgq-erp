import { z } from "zod";

export const categoriaSocialSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  monto_base: z.number().min(0, "El monto debe ser mayor o igual a 0").nullable().optional(),
  activa: z.boolean(),
});

export type CategoriaSocialSchemaType = z.infer<typeof categoriaSocialSchema>;

export const tipoCuotaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean(),
});

export type TipoCuotaSchemaType = z.infer<typeof tipoCuotaSchema>;

export const metodoCobranzaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  activo: z.boolean(),
});

export type MetodoCobranzaSchemaType = z.infer<typeof metodoCobranzaSchema>;
