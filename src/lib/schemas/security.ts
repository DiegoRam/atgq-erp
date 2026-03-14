import { z } from "zod";

export const usuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string(),
  rol_id: z.string().uuid("Debe seleccionar un rol"),
});

export type UsuarioSchemaType = z.infer<typeof usuarioSchema>;

export const rolSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
});

export type RolSchemaType = z.infer<typeof rolSchema>;
