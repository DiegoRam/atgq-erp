import { z } from "zod";

export const usuarioCreateSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol_id: z.string().uuid("Debe seleccionar un rol"),
});

export type UsuarioCreateSchemaType = z.infer<typeof usuarioCreateSchema>;

export const usuarioEditSchema = z.object({
  rol_id: z.string().uuid("Debe seleccionar un rol"),
});

export type UsuarioEditSchemaType = z.infer<typeof usuarioEditSchema>;

export const rolSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
});

export type RolSchemaType = z.infer<typeof rolSchema>;
