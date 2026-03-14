import { z } from "zod";

export const actividadSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  monto_cuota: z.number().min(0, "El monto debe ser mayor o igual a 0").nullable().optional(),
  activa: z.boolean(),
});

export type ActividadSchemaType = z.infer<typeof actividadSchema>;

export const actividadExtraSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  monto: z.number().min(0, "El monto debe ser mayor o igual a 0").nullable().optional(),
});

export type ActividadExtraSchemaType = z.infer<typeof actividadExtraSchema>;

export const turnoSchema = z
  .object({
    socio_id: z.string().uuid("Seleccione un socio"),
    instalacion_id: z.string().uuid("Seleccione una instalación"),
    fecha_turno: z.string().min(1, "Fecha requerida"),
    hora_inicio: z.string().min(1, "Hora de inicio requerida"),
    hora_fin: z.string().min(1, "Hora de fin requerida"),
  })
  .refine(
    (data) => data.hora_fin > data.hora_inicio,
    {
      message: "La hora de fin debe ser posterior a la hora de inicio",
      path: ["hora_fin"],
    },
  );

export type TurnoSchemaType = z.infer<typeof turnoSchema>;
