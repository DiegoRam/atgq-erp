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

export interface SociosSearchParams {
  page: number;
  pageSize: number;
  search?: string;
  categoria_ids?: string[];
  sort?: { id: string; desc: boolean } | null;
}

export interface CategoriaCount {
  categoria_id: string;
  nombre: string;
  count: number;
}

export interface CategoriaSocial {
  id: string;
  nombre: string;
  descripcion: string | null;
  monto_base: number | null;
  activa: boolean;
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

export interface TipoCuota {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface CategoriaSocialFormData {
  nombre: string;
  descripcion?: string | null;
  monto_base?: number | null;
  activa: boolean;
}

export interface TipoCuotaFormData {
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

export interface MetodoCobranzaFormData {
  nombre: string;
  activo: boolean;
}
