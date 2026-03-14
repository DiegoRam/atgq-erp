export interface CategoriaMovimiento {
  id: string;
  nombre: string;
  tipo: "ingreso" | "egreso";
  activa: boolean;
  created_at: string;
}

export interface CategoriaMovimientoFormData {
  nombre: string;
  tipo: "ingreso" | "egreso";
  activa: boolean;
}

export interface Caja {
  id: string;
  nombre: string;
  descripcion: string | null;
  saldo_inicial: number;
  activa: boolean;
  created_at: string;
  // Computed
  saldo_actual?: number;
}

export interface CajaFormData {
  nombre: string;
  descripcion?: string | null;
  saldo_inicial: number;
  activa: boolean;
}

export interface MovimientoFondo {
  id: string;
  caja_id: string;
  categoria_id: string;
  tipo: "ingreso" | "egreso" | "transferencia";
  monto: number;
  descripcion: string | null;
  fecha: string;
  caja_destino_id: string | null;
  referencia_id: string | null;
  usuario_id: string;
  created_at: string;
  // Joined
  caja?: { id: string; nombre: string };
  categoria?: { id: string; nombre: string };
  caja_destino?: { id: string; nombre: string } | null;
  usuario_email?: string;
}

export interface MovimientoFormData {
  tipo: "ingreso" | "egreso";
  caja_id: string;
  categoria_id: string;
  monto: number;
  descripcion?: string | null;
  fecha: string;
}

export interface MovimientosSearchParams {
  page: number;
  pageSize: number;
  caja_id?: string;
  tipo?: string;
  categoria_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface TransferenciaFormData {
  caja_origen_id: string;
  caja_destino_id: string;
  monto: number;
  descripcion?: string | null;
  fecha: string;
}
