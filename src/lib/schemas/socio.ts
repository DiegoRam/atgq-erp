import { z } from "zod";

export const socioSchema = z.object({
  nro_socio: z.number().int().positive("Nro Socio requerido"),
  apellido: z.string().min(1, "Apellido requerido").transform((v) => v.toUpperCase()),
  nombre: z.string().min(1, "Nombre requerido"),
  dni: z.string().min(1, "DNI requerido"),
  categoria_id: z.string().uuid("Seleccione una categoría"),
  fecha_alta: z.string().min(1, "Fecha alta requerida"),
  fecha_baja: z.string().nullable().optional(),
  metodo_cobranza_id: z.string().nullable().optional(),
  localidad: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
});

export type SocioSchemaType = z.infer<typeof socioSchema>;
