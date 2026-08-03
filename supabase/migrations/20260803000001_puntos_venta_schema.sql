-- ============================================================
-- ATGQ ERP — Punto de Venta: schema
-- Task: P10.1
-- Los sectores del club que venden al público pasan a ser
-- ubicaciones de stock de primera clase: una fila de `depositos`
-- con tipo = 'punto_venta'. Así `stock_inventario` y
-- `movimientos_stock` sirven para ambos sin tocar sus FKs.
-- Re-runnable: usa ON CONFLICT / IF NOT EXISTS donde aplica.
-- ============================================================

-- ------------------------------------------------------------
-- 1. depositos: tipo de ubicación + caja asociada
-- ------------------------------------------------------------
ALTER TABLE depositos
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'deposito',
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES cajas(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'depositos_tipo_check'
  ) THEN
    ALTER TABLE depositos
      ADD CONSTRAINT depositos_tipo_check
      CHECK (tipo IN ('deposito', 'punto_venta'));
  END IF;
END $$;

COMMENT ON COLUMN depositos.tipo IS
  'deposito = almacén interno; punto_venta = sector del club que vende al público';
COMMENT ON COLUMN depositos.caja_id IS
  'Caja de tesorería donde se acreditan las ventas de este punto de venta (solo para tipo = punto_venta)';

-- ------------------------------------------------------------
-- 2. movimientos_stock: destino de las transferencias
--    (espejo de movimientos_fondos.caja_destino_id)
-- ------------------------------------------------------------
ALTER TABLE movimientos_stock
  ADD COLUMN IF NOT EXISTS deposito_destino_id UUID REFERENCES depositos(id);

COMMENT ON COLUMN movimientos_stock.deposito_destino_id IS
  'Ubicación destino en la pata de egreso de una transferencia; NULL en ingresos/egresos comunes';

-- ------------------------------------------------------------
-- 3. Categorías de tesorería que usan las ventas
--    ('Ventas'/ingreso sólo estaba en seed.sql, nunca en una
--     migración: una DB creada con db push no la tenía)
-- ------------------------------------------------------------
INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Ventas', 'ingreso', true),
  ('Anulación de Ventas', 'egreso', true)
ON CONFLICT (nombre, tipo) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Puntos de venta reales (tomados del sistema legacy:
--    Deposito Central / Tiro Practico / Secretaria)
-- ------------------------------------------------------------
INSERT INTO depositos (nombre, descripcion, activo, tipo) VALUES
  ('Secretaria',    'Punto de venta — mostrador de secretaría', true, 'punto_venta'),
  ('Tiro Practico', 'Punto de venta — sector Tiro Práctico',    true, 'punto_venta')
ON CONFLICT (nombre) DO UPDATE SET tipo = 'punto_venta';

-- Vincular los PdV a la Caja Principal si existe y aún no tienen caja
UPDATE depositos d
   SET caja_id = (SELECT id FROM cajas WHERE nombre = 'Caja Principal' LIMIT 1)
 WHERE d.tipo = 'punto_venta'
   AND d.caja_id IS NULL
   AND EXISTS (SELECT 1 FROM cajas WHERE nombre = 'Caja Principal');

-- ------------------------------------------------------------
-- 5. ventas.punto_venta_id: nullable -> backfill -> NOT NULL
--    El legacy VentasCabecera no tiene columna de sector, así que
--    las ventas históricas caen todas al PdV por defecto.
-- ------------------------------------------------------------
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS punto_venta_id UUID REFERENCES depositos(id);

UPDATE ventas
   SET punto_venta_id = (
     SELECT id FROM depositos
      WHERE tipo = 'punto_venta' AND nombre = 'Secretaria'
      LIMIT 1)
 WHERE punto_venta_id IS NULL;

-- Red de seguridad por si 'Secretaria' no existiera
UPDATE ventas
   SET punto_venta_id = (
     SELECT id FROM depositos WHERE tipo = 'punto_venta' ORDER BY nombre LIMIT 1)
 WHERE punto_venta_id IS NULL;

ALTER TABLE ventas ALTER COLUMN punto_venta_id SET NOT NULL;

-- ------------------------------------------------------------
-- 6. Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ventas_punto_venta_fecha
  ON ventas(punto_venta_id, fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_dep_fecha
  ON movimientos_stock(deposito_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_destino
  ON movimientos_stock(deposito_destino_id) WHERE deposito_destino_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_referencia
  ON movimientos_stock(referencia_id) WHERE referencia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_inventario_deposito
  ON stock_inventario(deposito_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fondos_referencia
  ON movimientos_fondos(referencia_id) WHERE referencia_id IS NOT NULL;
