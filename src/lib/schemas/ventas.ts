import { z } from "zod";

export const clienteSchema = z.object({
  apellido: z.string().min(1, "Apellido requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  dni: z.string().nullable().optional(),
  email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  telefono: z.string().nullable().optional(),
});

export type ClienteSchemaType = z.infer<typeof clienteSchema>;

export const itemVentaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  precio: z.number().positive("El precio debe ser mayor a 0"),
  activo: z.boolean(),
  stock_item_id: z.string().uuid().nullable().optional(),
});

export type ItemVentaSchemaType = z.infer<typeof itemVentaSchema>;

export const nuevaVentaSchema = z
  .object({
    cliente_id: z.string().uuid().nullable().optional(),
    socio_id: z.string().uuid().nullable().optional(),
    metodo_pago_id: z.string().uuid("Seleccione un método de pago"),
    items: z
      .array(
        z.object({
          item_id: z.string().uuid(),
          cantidad: z.number().int().positive(),
          precio_unitario: z.number().positive(),
        }),
      )
      .min(1, "Agregue al menos un ítem"),
  })
  .refine(
    (data) => !!data.cliente_id || !!data.socio_id,
    {
      message: "Debe seleccionar un cliente o un socio",
      path: ["cliente_id"],
    },
  );

export type NuevaVentaSchemaType = z.infer<typeof nuevaVentaSchema>;
