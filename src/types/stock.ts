/** Una ubicación de stock es un depósito interno o un punto de venta */
export type TipoUbicacion = "deposito" | "punto_venta";

export const TIPO_UBICACION_LABELS: Record<TipoUbicacion, string> = {
  deposito: "Depósito",
  punto_venta: "Punto de Venta",
};

export interface Deposito {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  tipo: TipoUbicacion;
  caja_id: string | null;
  created_at: string;
  // Joined
  caja?: { id: string; nombre: string } | null;
  // Computed
  item_count?: number;
}

export interface DepositoFormData {
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  tipo: TipoUbicacion;
  caja_id?: string | null;
}

export interface StockItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  activo: boolean;
  created_at: string;
  // Computed
  stock_total?: number;
}

export interface StockItemFormData {
  nombre: string;
  descripcion?: string | null;
  unidad: string;
  activo: boolean;
  stock_inicial?: number;
  /** Ubicación donde se acredita el stock inicial */
  deposito_id?: string | null;
}

export interface InventarioRow {
  id: string;
  item_id: string;
  deposito_id: string;
  cantidad: number;
  updated_at: string;
  // Joined
  item?: { id: string; nombre: string; unidad: string };
  deposito?: { id: string; nombre: string; tipo: TipoUbicacion };
}

export interface MovimientoStock {
  id: string;
  item_id: string;
  deposito_id: string;
  deposito_destino_id: string | null;
  tipo: "ingreso" | "egreso" | "transferencia";
  cantidad: number;
  motivo: string | null;
  referencia_id: string | null;
  usuario_id: string;
  created_at: string;
  // Joined
  item?: { id: string; nombre: string };
  deposito?: { id: string; nombre: string; tipo: TipoUbicacion };
  deposito_destino?: { id: string; nombre: string } | null;
}

export interface MovimientoStockFormData {
  tipo: "ingreso" | "egreso";
  deposito_id: string;
  item_id: string;
  cantidad: number;
  motivo?: string | null;
}

export interface TransferenciaStockFormData {
  item_id: string;
  deposito_origen_id: string;
  deposito_destino_id: string;
  cantidad: number;
  motivo?: string | null;
}

/** Fila devuelta por la RPC transferir_stock */
export interface TransferenciaStockResult {
  movimiento_origen_id: string;
  movimiento_destino_id: string;
  stock_origen: number;
  stock_destino: number;
}

export interface MovimientosStockSearchParams {
  page: number;
  pageSize: number;
  item_id?: string;
  deposito_id?: string;
  tipo?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}
