-- ============================================================
-- ATGQ ERP — Initial Schema Migration
-- Task: P1.3
-- ============================================================

-- =========================
-- SOCIOS
-- =========================

CREATE TABLE metodos_cobranza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  monto_base NUMERIC(12,2),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grupos_familiares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id UUID, -- FK added after socios table exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nro_socio INTEGER NOT NULL UNIQUE,
  apellido TEXT NOT NULL,
  nombre TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  categoria_id UUID NOT NULL REFERENCES categorias_sociales(id),
  fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_baja DATE,
  metodo_cobranza_id UUID REFERENCES metodos_cobranza(id),
  grupo_familiar_id UUID REFERENCES grupos_familiares(id),
  localidad TEXT,
  fecha_nacimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK from grupos_familiares to socios
ALTER TABLE grupos_familiares
  ADD CONSTRAINT fk_grupos_familiares_titular
  FOREIGN KEY (titular_id) REFERENCES socios(id);

CREATE TABLE tipos_cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id),
  tipo_cuota_id UUID NOT NULL REFERENCES tipos_cuotas(id),
  periodo DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha_pago TIMESTAMPTZ,
  pagada BOOLEAN NOT NULL DEFAULT false,
  metodo_pago_id UUID REFERENCES metodos_cobranza(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- ACTIVIDADES
-- =========================

CREATE TABLE actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  monto_cuota NUMERIC(12,2),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE socios_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id),
  actividad_id UUID NOT NULL REFERENCES actividades(id),
  fecha_inscripcion DATE NOT NULL DEFAULT CURRENT_DATE,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (socio_id, actividad_id)
);

CREATE TABLE actividades_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE,
  monto NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- TURNOS
-- =========================

CREATE TABLE instalaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id),
  instalacion_id UUID NOT NULL REFERENCES instalaciones(id),
  fecha_turno DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado TEXT NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- VENTAS
-- =========================

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apellido TEXT NOT NULL,
  nombre TEXT NOT NULL,
  dni TEXT,
  email TEXT,
  telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(12,2) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  stock_item_id UUID REFERENCES stock_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  socio_id UUID REFERENCES socios(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC(12,2) NOT NULL,
  metodo_pago_id UUID REFERENCES metodos_cobranza(id),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  anulada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ventas_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items_ventas(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- STOCK
-- =========================

CREATE TABLE depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES stock_items(id),
  deposito_id UUID NOT NULL REFERENCES depositos(id),
  cantidad INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, deposito_id)
);

CREATE TABLE movimientos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES stock_items(id),
  deposito_id UUID NOT NULL REFERENCES depositos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'transferencia')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  motivo TEXT,
  referencia_id UUID,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- TESORERÍA
-- =========================

CREATE TABLE cajas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nombre, tipo)
);

CREATE TABLE movimientos_fondos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id UUID NOT NULL REFERENCES cajas(id),
  categoria_id UUID NOT NULL REFERENCES categorias_movimientos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'transferencia')),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  caja_destino_id UUID REFERENCES cajas(id),
  referencia_id UUID,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- SECURITY
-- =========================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permisos_modulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  puede_leer BOOLEAN NOT NULL DEFAULT false,
  puede_escribir BOOLEAN NOT NULL DEFAULT false,
  puede_eliminar BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rol_id, modulo)
);

CREATE TABLE usuarios_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rol_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rol_id)
);

-- =========================
-- ÍNDICES
-- =========================

CREATE INDEX idx_socios_nro_socio ON socios(nro_socio);
CREATE INDEX idx_socios_dni ON socios(dni);
CREATE INDEX idx_socios_categoria ON socios(categoria_id);
CREATE INDEX idx_cuotas_socio_periodo ON cuotas(socio_id, periodo);
CREATE INDEX idx_movimientos_fondos_caja_fecha ON movimientos_fondos(caja_id, fecha);
CREATE INDEX idx_ventas_fecha ON ventas(fecha);

-- =========================
-- ROW LEVEL SECURITY (habilitado, sin policies aún → P9.3)
-- =========================

ALTER TABLE metodos_cobranza ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_familiares ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE instalaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_fondos ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;

-- =========================
-- TRIGGER: auto-update updated_at en socios
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_socios_updated_at
  BEFORE UPDATE ON socios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
