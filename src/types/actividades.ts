export interface Actividad {
  id: string;
  nombre: string;
  descripcion: string | null;
  monto_cuota: number | null;
  activa: boolean;
  created_at: string;
  // Computed
  inscriptos_count?: number;
}

export interface ActividadFormData {
  nombre: string;
  descripcion?: string | null;
  monto_cuota?: number | null;
  activa: boolean;
}

export interface SocioActividad {
  id: string;
  socio_id: string;
  actividad_id: string;
  fecha_inscripcion: string;
  activa: boolean;
  created_at: string;
  // Joined
  socio?: {
    id: string;
    nro_socio: number;
    apellido: string;
    nombre: string;
  };
  actividad?: {
    id: string;
    nombre: string;
    monto_cuota: number | null;
  };
}

export interface ActividadExtra {
  id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  monto: number | null;
  created_at: string;
}

export interface ActividadExtraFormData {
  nombre: string;
  descripcion?: string | null;
  fecha?: string | null;
  monto?: number | null;
}

export interface Instalacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
}

export interface Turno {
  id: string;
  socio_id: string;
  instalacion_id: string;
  fecha_turno: string;
  hora_inicio: string;
  hora_fin: string;
  estado: "confirmado" | "cancelado";
  created_at: string;
  // Joined
  socio?: {
    id: string;
    nro_socio: number;
    apellido: string;
    nombre: string;
  };
  instalacion?: {
    id: string;
    nombre: string;
  };
}

export interface TurnoFormData {
  socio_id: string;
  instalacion_id: string;
  fecha_turno: string;
  hora_inicio: string;
  hora_fin: string;
}
