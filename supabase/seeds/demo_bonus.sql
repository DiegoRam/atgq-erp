-- ============================================================
-- ATGQ ERP — Seed: datos demo "bonus" (ventas, stock, turnos)
-- Idempotente. Debe correr DESPUÉS de seed.sql (necesita socios,
-- categorías, instalaciones) y con un usuario Auth existente.
--
-- Nota: los seeds de módulo (migraciones 04-07) buscan socios
-- nro_socio 1001-1005, que seed.sql no crea. Aquí se agregan como
-- "socios puente" para que ventas/inscripciones/turnos se poblen.
-- ============================================================

-- Socios puente 1001-1005 (referenciados por ventas/actividades)
INSERT INTO socios (nro_socio, apellido, nombre, dni, categoria_id, fecha_alta, metodo_cobranza_id, localidad, fecha_nacimiento) VALUES
  (1001, 'Demo', 'Socio Uno',    '90000001', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-01-10', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), 'Quilmes', '1985-01-01'),
  (1002, 'Demo', 'Socio Dos',    '90000002', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-02-10', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), 'Quilmes', '1986-02-01'),
  (1003, 'Demo', 'Socio Tres',   '90000003', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-03-10', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), 'Quilmes', '1987-03-01'),
  (1004, 'Demo', 'Socio Cuatro', '90000004', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-04-10', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), 'Quilmes', '1988-04-01'),
  (1005, 'Demo', 'Socio Cinco',  '90000005', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-05-10', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), 'Quilmes', '1989-05-01')
ON CONFLICT (nro_socio) DO NOTHING;

-- ---------- Movimientos de stock (bloque DO del stock_seed) ----------
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

  -- Idempotencia: si ya hay movimientos de stock, no re-insertar
  IF (SELECT COUNT(*) FROM movimientos_stock) > 0 THEN
    RAISE NOTICE 'movimientos_stock ya poblado, se omite';
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

-- ---------- Ventas demo (bloque DO del ventas_seed) ----------
DO $$
DECLARE
  v_user_id UUID;
  v_venta_id UUID;
  v_met_efectivo UUID;
  v_met_visa UUID;
  v_met_transf UUID;
  v_socio1 UUID;
  v_socio2 UUID;
  v_socio3 UUID;
  v_cliente1 UUID;
  v_cliente2 UUID;
  v_cliente3 UUID;
  v_pdv1 UUID;
  v_pdv2 UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth users found, skipping ventas seed';
    RETURN;
  END IF;

  SELECT id INTO v_pdv1 FROM depositos WHERE nombre = 'Secretaria'    AND tipo = 'punto_venta';
  SELECT id INTO v_pdv2 FROM depositos WHERE nombre = 'Tiro Practico' AND tipo = 'punto_venta';
  IF v_pdv1 IS NULL THEN
    RAISE NOTICE 'No hay puntos de venta, se omite el seed de ventas';
    RETURN;
  END IF;
  v_pdv2 := COALESCE(v_pdv2, v_pdv1);

  -- Idempotencia: si ya hay ventas, no re-insertar
  IF (SELECT COUNT(*) FROM ventas) > 0 THEN
    RAISE NOTICE 'ventas ya poblado, se omite';
    RETURN;
  END IF;

  SELECT id INTO v_met_efectivo FROM metodos_cobranza WHERE nombre = 'Efectivo';
  SELECT id INTO v_met_visa FROM metodos_cobranza WHERE nombre = 'VISA Crédito';
  SELECT id INTO v_met_transf FROM metodos_cobranza WHERE nombre = 'Transferencia Bancaria';

  SELECT id INTO v_socio1 FROM socios WHERE nro_socio = 1001;
  SELECT id INTO v_socio2 FROM socios WHERE nro_socio = 1002;
  SELECT id INTO v_socio3 FROM socios WHERE nro_socio = 1003;

  SELECT id INTO v_cliente1 FROM clientes WHERE apellido = 'Fernández' AND nombre = 'Carlos' LIMIT 1;
  SELECT id INTO v_cliente2 FROM clientes WHERE apellido = 'López' AND nombre = 'María' LIMIT 1;
  SELECT id INTO v_cliente3 FROM clientes WHERE apellido = 'Gómez' AND nombre = 'Roberto' LIMIT 1;

  -- Venta 1: Socio 1001, Efectivo, Jan 5
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio1, '2026-01-05 10:30:00-03', 5500.00, v_met_efectivo, v_user_id, false, '2026-01-05 10:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 2, 250.00, 500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 2: Cliente Fernández, VISA, Jan 10
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente1, NULL, '2026-01-10 14:00:00-03', 20000.00, v_met_visa, v_user_id, false, '2026-01-10 14:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Protector Auditivo'), 1, 12000.00, 12000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Lentes de Protección'), 1, 8000.00, 8000.00);

  -- Venta 3: Socio 1002, Efectivo, Jan 15
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio2, '2026-01-15 11:00:00-03', 9700.00, v_met_efectivo, v_user_id, false, '2026-01-15 11:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 1, 4500.00, 4500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 1, 200.00, 200.00);

  -- Venta 4: Cliente López, Transferencia, Jan 20
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente2, NULL, '2026-01-20 16:00:00-03', 30000.00, v_met_transf, v_user_id, false, '2026-01-20 16:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal 9mm x50'), 2, 15000.00, 30000.00);

  -- Venta 5: Socio 1003, Efectivo, Jan 25 (ANULADA)
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio3, '2026-01-25 09:30:00-03', 3000.00, v_met_efectivo, v_user_id, true, '2026-01-25 09:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Entrada Visitante'), 1, 3000.00, 3000.00);

  -- Venta 6: Socio 1001, VISA, Feb 2
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio1, '2026-02-02 10:00:00-03', 8500.00, v_met_visa, v_user_id, false, '2026-02-02 10:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00);

  -- Venta 7: Cliente Gómez, Efectivo, Feb 8
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente3, NULL, '2026-02-08 15:30:00-03', 13000.00, v_met_efectivo, v_user_id, false, '2026-02-08 15:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (2h)'), 1, 8000.00, 8000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 8: Socio 1002, Transferencia, Feb 12
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio2, '2026-02-12 11:30:00-03', 10700.00, v_met_transf, v_user_id, false, '2026-02-12 11:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 3 Zonas'), 2, 350.00, 700.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

  -- Venta 9: Cliente Fernández, Efectivo, Feb 18
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente1, NULL, '2026-02-18 10:00:00-03', 4500.00, v_met_efectivo, v_user_id, false, '2026-02-18 10:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 1, 4500.00, 4500.00);

  -- Venta 10: Socio 1003, VISA, Feb 22
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio3, '2026-02-22 14:00:00-03', 16000.00, v_met_visa, v_user_id, false, '2026-02-22 14:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (2h)'), 1, 8000.00, 8000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Lentes de Protección'), 1, 8000.00, 8000.00);

  -- Venta 11: Cliente López, Efectivo, Feb 28
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente2, NULL, '2026-02-28 16:30:00-03', 5000.00, v_met_efectivo, v_user_id, false, '2026-02-28 16:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 12: Socio 1001, Efectivo, Mar 1
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio1, '2026-03-01 09:00:00-03', 750.00, v_met_efectivo, v_user_id, false, '2026-03-01 09:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 1 Zona'), 1, 300.00, 300.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 1, 250.00, 250.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 1, 200.00, 200.00);

  -- Venta 13: Cliente Gómez, Transferencia, Mar 3
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente3, NULL, '2026-03-03 12:00:00-03', 18000.00, v_met_transf, v_user_id, false, '2026-03-03 12:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Kit Limpieza Armas'), 1, 18000.00, 18000.00);

  -- Venta 14: Socio 1002, Efectivo, Mar 5
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio2, '2026-03-05 10:30:00-03', 9000.00, v_met_efectivo, v_user_id, false, '2026-03-05 10:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 2, 4500.00, 9000.00);

  -- Venta 15: Socio 1003, VISA, Mar 7
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio3, '2026-03-07 15:00:00-03', 25000.00, v_met_visa, v_user_id, false, '2026-03-07 15:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal 9mm x50'), 1, 15000.00, 15000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

  -- Venta 16: Cliente Fernández, Efectivo, Mar 8
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente1, NULL, '2026-03-08 11:00:00-03', 6000.00, v_met_efectivo, v_user_id, false, '2026-03-08 11:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Entrada Visitante'), 2, 3000.00, 6000.00);

  -- Venta 17: Socio 1001, Transferencia, Mar 10
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio1, '2026-03-10 14:30:00-03', 17000.00, v_met_transf, v_user_id, false, '2026-03-10 14:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00);

  -- Venta 18: Cliente López, VISA, Mar 11 (ANULADA)
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente2, NULL, '2026-03-11 10:00:00-03', 12000.00, v_met_visa, v_user_id, true, '2026-03-11 10:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Protector Auditivo'), 1, 12000.00, 12000.00);

  -- Venta 19: Socio 1002, Efectivo, Mar 12
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (NULL, v_socio2, '2026-03-12 11:00:00-03', 8200.00, v_met_efectivo, v_user_id, false, '2026-03-12 11:00:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 50m'), 2, 220.00, 440.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 1 Zona'), 2, 300.00, 600.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 4, 250.00, 1000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 3, 200.00, 600.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 3 Zonas'), 2, 280.00, 560.00);

  -- Venta 20: Cliente Gómez, Efectivo, Mar 14
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at, punto_venta_id)
  VALUES (v_cliente3, NULL, '2026-03-14 09:30:00-03', 10000.00, v_met_efectivo, v_user_id, false, '2026-03-14 09:30:00-03', v_pdv1)
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

  -- Repartir las ventas demo entre los dos puntos de venta para que
  -- los filtros y reportes por PdV tengan datos de ambos lados
  UPDATE ventas
     SET punto_venta_id = v_pdv2
   WHERE punto_venta_id = v_pdv1
     AND (extract(day FROM fecha)::int % 2) = 0;

END $$;

-- ---------- Inscripciones + turnos (bloque DO del actividades_turnos_seed) ----------
DO $$
DECLARE
  v_socio1 UUID;
  v_socio2 UUID;
  v_socio3 UUID;
  v_socio4 UUID;
  v_socio5 UUID;
  v_act_tiro UUID;
  v_act_gimnasia UUID;
  v_act_natacion UUID;
  v_act_defensa UUID;
  v_act_yoga UUID;
  v_inst_cancha UUID;
  v_inst_gimnasio UUID;
  v_inst_salon UUID;
BEGIN
  -- Lookup socios by nro_socio
  SELECT id INTO v_socio1 FROM socios WHERE nro_socio = 1001;
  SELECT id INTO v_socio2 FROM socios WHERE nro_socio = 1002;
  SELECT id INTO v_socio3 FROM socios WHERE nro_socio = 1003;
  SELECT id INTO v_socio4 FROM socios WHERE nro_socio = 1004;
  SELECT id INTO v_socio5 FROM socios WHERE nro_socio = 1005;

  -- Lookup actividades
  SELECT id INTO v_act_tiro FROM actividades WHERE nombre = 'Tiro Deportivo';
  SELECT id INTO v_act_gimnasia FROM actividades WHERE nombre = 'Gimnasia';
  SELECT id INTO v_act_natacion FROM actividades WHERE nombre = 'Natación';
  SELECT id INTO v_act_defensa FROM actividades WHERE nombre = 'Defensa Personal';
  SELECT id INTO v_act_yoga FROM actividades WHERE nombre = 'Yoga';

  -- Lookup instalaciones
  SELECT id INTO v_inst_cancha FROM instalaciones WHERE nombre = 'Cancha Tiro';
  SELECT id INTO v_inst_gimnasio FROM instalaciones WHERE nombre = 'Gimnasio';
  SELECT id INTO v_inst_salon FROM instalaciones WHERE nombre = 'Salón Principal';

  -- Skip if socios not found (seed data may not exist)
  IF v_socio1 IS NULL THEN
    RAISE NOTICE 'Demo socios not found, skipping inscripciones and turnos';
    RETURN;
  END IF;

  -- Idempotencia: si ya hay turnos, no re-insertar
  IF (SELECT COUNT(*) FROM turnos) > 0 THEN
    RAISE NOTICE 'turnos ya poblado, se omite';
    RETURN;
  END IF;

  -- Inscripciones: each socio in 2-3 actividades
  INSERT INTO socios_actividades (socio_id, actividad_id, fecha_inscripcion, activa) VALUES
    (v_socio1, v_act_tiro, '2026-01-10', true),
    (v_socio1, v_act_gimnasia, '2026-01-15', true),
    (v_socio1, v_act_defensa, '2026-02-01', true),
    (v_socio2, v_act_tiro, '2026-01-12', true),
    (v_socio2, v_act_natacion, '2026-01-20', true),
    (v_socio3, v_act_gimnasia, '2026-02-05', true),
    (v_socio3, v_act_yoga, '2026-02-10', true),
    (v_socio3, v_act_natacion, '2026-02-15', true),
    (v_socio4, v_act_tiro, '2026-01-25', true),
    (v_socio4, v_act_defensa, '2026-03-01', true),
    (v_socio5, v_act_yoga, '2026-02-20', true),
    (v_socio5, v_act_gimnasia, '2026-03-05', true)
  ON CONFLICT (socio_id, actividad_id) DO NOTHING;

  -- Turnos demo: mix of confirmado/cancelado
  INSERT INTO turnos (socio_id, instalacion_id, fecha_turno, hora_inicio, hora_fin, estado) VALUES
    (v_socio1, v_inst_cancha, '2026-01-15', '09:00', '10:00', 'confirmado'),
    (v_socio2, v_inst_cancha, '2026-01-15', '10:00', '11:00', 'confirmado'),
    (v_socio3, v_inst_gimnasio, '2026-02-10', '14:00', '15:30', 'confirmado'),
    (v_socio1, v_inst_salon, '2026-02-20', '16:00', '17:00', 'cancelado'),
    (v_socio4, v_inst_cancha, '2026-03-01', '09:00', '10:30', 'confirmado'),
    (v_socio5, v_inst_gimnasio, '2026-03-05', '10:00', '11:00', 'confirmado'),
    (v_socio2, v_inst_salon, '2026-03-10', '18:00', '19:00', 'confirmado'),
    (v_socio3, v_inst_cancha, '2026-03-12', '11:00', '12:00', 'cancelado');

END $$;
