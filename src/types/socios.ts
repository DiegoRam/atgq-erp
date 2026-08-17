export interface Socio {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  dni: string;
  categoria_id: string;
  fecha_alta: string;
  fecha_baja: string | null;
  metodo_cobranza_id: string | null;
  grupo_familiar_id: string | null;
  localidad: string | null;
  fecha_nacimiento: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  categoria?: { id: string; nombre: string };
  metodo_cobranza?: { id: string; nombre: string } | null;
  // Computed
  cuotas_pagas?: number;
  cuotas_impagas?: number;
}

export interface SocioFormData {
  nro_socio: number;
  apellido: string;
  nombre: string;
  dni: string;
  categoria_id: string;
  fecha_alta: string;
  fecha_baja?: string | null;
  metodo_cobranza_id?: string | null;
  localidad?: string | null;
  fecha_nacimiento?: string | null;
}

/**
 * En los datos migrados del legacy el estado de un socio vive en dos lugares
 * que no están sincronizados: `fecha_baja` y la categoría social (existe una
 * categoría literal "BAJA"). "activos" exige ambas condiciones; "bajas" es el
 * complemento exacto, así que activos + bajas === el padrón completo.
 */
export type EstadoSocio = "todos" | "activos" | "bajas";

export interface SociosSearchParams {
  page: number;
  pageSize: number;
  search?: string;
  categoria_ids?: string[];
  estado?: EstadoSocio;
  sort?: { id: string; desc: boolean } | null;
}

export interface CategoriaCount {
  categoria_id: string;
  nombre: string;
  count: number;
}

export interface EstadoCount {
  estado: "activos" | "bajas";
  count: number;
}

export interface CategoriaSocial {
  id: string;
  nombre: string;
  descripcion: string | null;
  monto_base: number | null;
  activa: boolean;
  /** Si sus socios cuentan como activos en el dashboard y en el filtro Estado */
  cuenta_como_activo: boolean;
  /** Si sus socios están habilitados a votar en asamblea (padrón electoral) */
  habilita_voto: boolean;
}

export interface MetodoCobranza {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Cuota {
  id: string;
  socio_id: string;
  tipo_cuota_id: string;
  periodo: string;
  monto: number;
  fecha_pago: string | null;
  pagada: boolean;
  metodo_pago_id: string | null;
  created_at: string;
  // Joined
  tipo_cuota?: { id: string; nombre: string };
  metodo_pago?: { id: string; nombre: string } | null;
}

export interface GrupoFamiliar {
  id: string;
  titular_id: string | null;
  created_at: string;
  // Joined
  titular?: { id: string; nro_socio: number; apellido: string; nombre: string } | null;
  miembros?: { id: string; nro_socio: number; apellido: string; nombre: string }[];
}

export interface SocioMoroso {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  dni: string;
  categoria: string;
  cuotas_impagas: number;
  monto_adeudado: number;
  ultima_cuota_pagada: string | null;
}

/**
 * Fila del RPC `get_padron` — espejo exacto de su RETURNS TABLE.
 *
 * `categoria` viene plano (texto), no como el objeto anidado de `Socio`.
 * `edad` y `antiguedad_anios` los calcula Postgres con `age()` contra
 * `current_date`: no recalcularlos en el cliente (`formatAntiguedad` parsea la
 * fecha como medianoche UTC y en ART se corre un día, justo el del aniversario).
 * `periodo_corte` es el último período de cuota social emitido —el corte del
 * criterio "al día"— y es igual en todas las filas; `null` si el club nunca
 * emitió una cuota social.
 */
export interface PadronRow {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  dni: string;
  categoria_id: string;
  categoria: string;
  fecha_alta: string;
  localidad: string | null;
  fecha_nacimiento: string | null;
  edad: number | null;
  antiguedad_anios: number;
  habilita_voto: boolean;
  cuotas_sociales_emitidas: number;
  periodo_corte: string | null;
}

export interface TipoCuota {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** Si una cuota impaga de este tipo inhabilita a votar en asamblea */
  afecta_padron: boolean;
}

export interface CategoriaSocialFormData {
  nombre: string;
  descripcion?: string | null;
  monto_base?: number | null;
  activa: boolean;
  cuenta_como_activo: boolean;
  habilita_voto: boolean;
}

export interface TipoCuotaFormData {
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  afecta_padron: boolean;
}

export interface MetodoCobranzaFormData {
  nombre: string;
  activo: boolean;
}
