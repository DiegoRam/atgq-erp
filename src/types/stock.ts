export interface Deposito {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  // Computed
  item_count?: number;
}

export interface DepositoFormData {
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
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
}

export interface InventarioRow {
  id: string;
  item_id: string;
  deposito_id: string;
  cantidad: number;
  updated_at: string;
  // Joined
  item?: { id: string; nombre: string; unidad: string };
  deposito?: { id: string; nombre: string };
}

export interface MovimientoStock {
  id: string;
  item_id: string;
  deposito_id: string;
  tipo: "ingreso" | "egreso" | "transferencia";
  cantidad: number;
  motivo: string | null;
  referencia_id: string | null;
  usuario_id: string;
  created_at: string;
  // Joined
  item?: { id: string; nombre: string };
  deposito?: { id: string; nombre: string };
}

export interface MovimientoStockFormData {
  tipo: "ingreso" | "egreso";
  deposito_id: string;
  item_id: string;
  cantidad: number;
  motivo?: string | null;
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
