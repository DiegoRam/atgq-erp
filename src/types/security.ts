export const MODULOS = [
  "socios",
  "actividades",
  "turnos",
  "ventas",
  "stock",
  "tesoreria",
  "seguridad",
] as const;

export type Modulo = (typeof MODULOS)[number];

export const MODULO_LABELS: Record<Modulo, string> = {
  socios: "SOCIOS",
  actividades: "ACTIVIDADES",
  turnos: "TURNOS",
  ventas: "VENTAS",
  stock: "STOCK",
  tesoreria: "TESORERÍA",
  seguridad: "Security",
};

export interface Role {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
}

export interface PermisoModulo {
  id: string;
  rol_id: string;
  modulo: string;
  puede_leer: boolean;
  puede_escribir: boolean;
  puede_eliminar: boolean;
}

export interface UsuarioRol {
  id: string;
  user_id: string;
  rol_id: string;
  created_at: string;
}

export interface UsuarioSistema {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  rol_id: string | null;
  rol_nombre: string | null;
}

export interface UserPermissions {
  modulo: string;
  puede_leer: boolean;
  puede_escribir: boolean;
  puede_eliminar: boolean;
}

export interface RoleWithCount extends Role {
  usuarios_count: number;
}
