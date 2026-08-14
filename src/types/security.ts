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
  seguridad: "SEGURIDAD",
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
  /**
   * Cuenta que estuvo vinculada a un socio de la app móvil y fue desvinculada.
   * Su email lo eligió el socio al activar la app, sin verificación y fuera del
   * control del club, así que conviene distinguirla de una cuenta de staff
   * antes de asignarle un rol del ERP.
   */
  ex_cuenta_socio?: boolean;
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
