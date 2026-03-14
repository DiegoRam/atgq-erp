-- ============================================================
-- STOCK Seed Data
-- Task: P5.1–P5.5
-- Re-runnable: uses ON CONFLICT DO NOTHING
-- ============================================================

-- =========================
-- Depósito Central (ya existe en seed.sql, asegurar)
-- =========================

INSERT INTO depositos (nombre, descripcion, activo) VALUES
  ('Deposito Central', 'Depósito principal del club', true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Stock Items (~15)
-- =========================

INSERT INTO stock_items (nombre, descripcion, unidad, activo) VALUES
  ('Blanco Carabina Neumática', 'Blanco para carabina de aire comprimido', 'unidad', true),
  ('Blanco Fusil 1 Zona', 'Blanco de tiro fusil una zona', 'unidad', true),
  ('Blanco Fusil 3 Zonas', 'Blanco de tiro fusil tres zonas', 'unidad', true),
  ('Blanco Pistola 25m', 'Blanco de tiro pistola 25 metros', 'unidad', true),
  ('Blanco Pistola 50m', 'Blanco de tiro pistola 50 metros', 'unidad', true),
  ('Blanco Silueta Metálica', 'Blanco silueta para tiro práctico', 'unidad', true),
  ('Cart. RD Cal 12 - 24 gr', 'Cartuchos recargados calibre 12, 24 gramos', 'caja x25', true),
  ('Cart. RD Cal 12 - 28 gr', 'Cartuchos recargados calibre 12, 28 gramos', 'caja x25', true),
  ('Cart. Cal .22 LR', 'Cartuchos calibre .22 Long Rifle', 'caja x50', true),
  ('Cart. Cal 9mm', 'Cartuchos calibre 9mm', 'caja x50', true),
  ('Protector Auditivo', 'Protector auditivo tipo copa', 'unidad', true),
  ('Lentes de Protección', 'Lentes de seguridad para tiro', 'unidad', true),
  ('Kit Limpieza Armas', 'Kit completo limpieza de armas', 'unidad', true),
  ('Aceite Lubricante', 'Aceite lubricante para armas', 'unidad', true),
  ('Parche de Limpieza', 'Parches de limpieza para cañón', 'bolsa x100', true)
ON CONFLICT DO NOTHING;

-- =========================
-- Stock Inventario + Movimientos Demo
-- =========================

DO $$
DECLARE
  v_user_id UUID;
  v_deposito_central UUID;
  v_item_id UUID;
  v_item_record RECORD;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth users found, skipping stock seed';
    RETURN;
  END IF;

  SELECT id INTO v_deposito_central FROM depositos WHERE nombre = 'Deposito Central';

  -- Set initial inventory for each item in Deposito Central
  -- Varied quantities: some high, some low, some zero, one negative
  FOR v_item_record IN
    SELECT id, nombre FROM stock_items ORDER BY nombre
  LOOP
    v_item_id := v_item_record.id;

    -- Determine quantity based on item type
    IF v_item_record.nombre LIKE 'Blanco%' THEN
      -- Blancos: varied quantities
      INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
      VALUES (v_item_id, v_deposito_central,
        CASE v_item_record.nombre
          WHEN 'Blanco Carabina Neumática' THEN 150
          WHEN 'Blanco Fusil 1 Zona' THEN 80
          WHEN 'Blanco Fusil 3 Zonas' THEN 45
          WHEN 'Blanco Pistola 25m' THEN 200
          WHEN 'Blanco Pistola 50m' THEN 8
          WHEN 'Blanco Silueta Metálica' THEN 12
          ELSE 50
        END
      )
      ON CONFLICT (item_id, deposito_id) DO NOTHING;

    ELSIF v_item_record.nombre LIKE 'Cart.%' THEN
      -- Cartuchos: some low, one negative
      INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
      VALUES (v_item_id, v_deposito_central,
        CASE v_item_record.nombre
          WHEN 'Cart. RD Cal 12 - 24 gr' THEN 35
          WHEN 'Cart. RD Cal 12 - 28 gr' THEN -2
          WHEN 'Cart. Cal .22 LR' THEN 60
          WHEN 'Cart. Cal 9mm' THEN 5
          ELSE 20
        END
      )
      ON CONFLICT (item_id, deposito_id) DO NOTHING;

    ELSE
      -- Otros: protección, limpieza
      INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
      VALUES (v_item_id, v_deposito_central,
        CASE v_item_record.nombre
          WHEN 'Protector Auditivo' THEN 10
          WHEN 'Lentes de Protección' THEN 6
          WHEN 'Kit Limpieza Armas' THEN 3
          WHEN 'Aceite Lubricante' THEN 0
          WHEN 'Parche de Limpieza' THEN 15
          ELSE 10
        END
      )
      ON CONFLICT (item_id, deposito_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Sample movements (Jan-Mar 2026)
  -- January
  INSERT INTO movimientos_stock (item_id, deposito_id, tipo, cantidad, motivo, usuario_id, created_at) VALUES
    ((SELECT id FROM stock_items WHERE nombre = 'Blanco Carabina Neumática'), v_deposito_central, 'ingreso', 200, 'Compra proveedor', v_user_id, '2026-01-10 10:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Cart. RD Cal 12 - 24 gr'), v_deposito_central, 'ingreso', 50, 'Compra proveedor', v_user_id, '2026-01-12 11:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Blanco Carabina Neumática'), v_deposito_central, 'egreso', 50, 'Uso competencia interna', v_user_id, '2026-01-20 14:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Cart. Cal .22 LR'), v_deposito_central, 'ingreso', 100, 'Compra proveedor', v_user_id, '2026-01-25 09:00:00-03')
  ON CONFLICT DO NOTHING;

  -- February
  INSERT INTO movimientos_stock (item_id, deposito_id, tipo, cantidad, motivo, usuario_id, created_at) VALUES
    ((SELECT id FROM stock_items WHERE nombre = 'Blanco Fusil 1 Zona'), v_deposito_central, 'egreso', 20, 'Práctica socios', v_user_id, '2026-02-05 10:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Cart. Cal 9mm'), v_deposito_central, 'ingreso', 30, 'Compra proveedor', v_user_id, '2026-02-10 11:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Protector Auditivo'), v_deposito_central, 'egreso', 2, 'Reposición deteriorados', v_user_id, '2026-02-15 15:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Cart. RD Cal 12 - 28 gr'), v_deposito_central, 'egreso', 12, 'Competencia zonal', v_user_id, '2026-02-20 09:00:00-03')
  ON CONFLICT DO NOTHING;

  -- March
  INSERT INTO movimientos_stock (item_id, deposito_id, tipo, cantidad, motivo, usuario_id, created_at) VALUES
    ((SELECT id FROM stock_items WHERE nombre = 'Blanco Pistola 25m'), v_deposito_central, 'ingreso', 100, 'Compra mayorista', v_user_id, '2026-03-01 10:00:00-03'),
    ((SELECT id FROM stock_items WHERE nombre = 'Kit Limpieza Armas'), v_deposito_central, 'ingreso', 5, 'Reposición stock', v_user_id, '2026-03-05 11:00:00-03')
  ON CONFLICT DO NOTHING;
END $$;
