export interface Cliente {
  id: string;
  apellido: string;
  nombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  created_at: string;
  // Computed
  cant_compras?: number;
  total_comprado?: number;
}

export interface ClienteFormData {
  apellido: string;
  nombre: string;
  dni?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export interface ItemVenta {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Tarifa de socio */
  precio: number;
  /** Tarifa de no socio: por defecto `precio` + 20%, editable a mano */
  precio_no_socio: number;
  activo: boolean;
  stock_item_id: string | null;
  created_at: string;
  // Joined
  stock_item?: { id: string; nombre: string } | null;
}

export interface ItemVentaFormData {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  precio_no_socio: number;
  activo: boolean;
  stock_item_id?: string | null;
}

export interface Venta {
  id: string;
  cliente_id: string | null;
  socio_id: string | null;
  punto_venta_id: string;
  fecha: string;
  total: number;
  metodo_pago_id: string | null;
  usuario_id: string;
  anulada: boolean;
  created_at: string;
  // No socio: comprador ocasional cargado a mano en el mostrador
  no_socio_nombre: string | null;
  no_socio_dni: string | null;
  no_socio_credencial_vencimiento: string | null;
  // Joined
  cliente?: { id: string; apellido: string; nombre: string } | null;
  socio?: { id: string; nro_socio: number; apellido: string; nombre: string } | null;
  metodo_pago?: { id: string; nombre: string } | null;
  punto_venta?: { id: string; nombre: string } | null;
  items_count?: number;
}

export interface VentaDetail extends Venta {
  items: VentaItem[];
}

export interface VentaItem {
  id: string;
  venta_id: string;
  item_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
  // Joined
  item?: { id: string; nombre: string };
}

export interface CartItem {
  item_id: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  stock_item_id: string | null;
}

export interface NuevaVentaData {
  punto_venta_id: string;
  cliente_id?: string | null;
  socio_id?: string | null;
  metodo_pago_id: string;
  // Van los tres o ninguno; sólo cuando no hay socio_id
  no_socio_nombre?: string | null;
  no_socio_dni?: string | null;
  no_socio_credencial_vencimiento?: string | null;
  // Sin precio_unitario: el precio lo resuelve registrar_venta desde items_ventas
  items: { item_id: string; cantidad: number }[];
}

/** Fila devuelta por la RPC registrar_venta */
export interface CrearVentaResult {
  venta_id: string;
  venta_total: number;
  movimiento_fondo_id: string | null;
  items_negativos: { nombre: string; cantidad: number }[];
}

/** Fila devuelta por la RPC anular_venta */
export interface AnularVentaResult {
  items_restituidos: number;
  movimiento_fondo_id: string | null;
}

export interface VentasSearchParams {
  page: number;
  pageSize: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string; // "todas" | "activas" | "anuladas"
  punto_venta_id?: string;
}
