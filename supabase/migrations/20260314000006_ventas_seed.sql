-- ============================================================
-- VENTAS Seed Data
-- Task: P6.1–P6.6
-- Re-runnable: uses ON CONFLICT DO NOTHING
-- ============================================================

-- =========================
-- Clientes (~5)
-- =========================

INSERT INTO clientes (apellido, nombre, dni, email, telefono) VALUES
  ('Fernández', 'Carlos', '28456789', 'cfernandez@email.com', '1155001122'),
  ('López', 'María', '31234567', 'mlopez@email.com', '1155003344'),
  ('Gómez', 'Roberto', '25678901', NULL, '1155005566'),
  ('Martínez', 'Ana', '33456789', 'amartinez@email.com', NULL),
  ('Rodríguez', 'Pablo', '27890123', 'prodriguez@email.com', '1155007788')
ON CONFLICT DO NOTHING;

-- =========================
-- Items de Ventas (~15)
-- Some linked to stock_items
-- =========================

INSERT INTO items_ventas (nombre, descripcion, precio, activo, stock_item_id) VALUES
  ('Blanco Carabina Neumática', 'Blanco para carabina de aire comprimido', 250.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Blanco Carabina Neumática')),
  ('Blanco Fusil 1 Zona', 'Blanco de tiro fusil una zona', 300.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Blanco Fusil 1 Zona')),
  ('Blanco Fusil 3 Zonas', 'Blanco de tiro fusil tres zonas', 350.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Blanco Fusil 3 Zonas')),
  ('Blanco Pistola 25m', 'Blanco de tiro pistola 25 metros', 200.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Blanco Pistola 25m')),
  ('Blanco Pistola 50m', 'Blanco de tiro pistola 50 metros', 220.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Blanco Pistola 50m')),
  ('Cart. RD Cal 12 x25', 'Caja de cartuchos recargados cal 12', 4500.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Cart. RD Cal 12 - 24 gr')),
  ('Cart. Cal .22 LR x50', 'Caja de cartuchos calibre .22 LR', 8500.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Cart. Cal .22 LR')),
  ('Cart. Cal 9mm x50', 'Caja de cartuchos calibre 9mm', 15000.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Cart. Cal 9mm')),
  ('Protector Auditivo', 'Protector auditivo tipo copa', 12000.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Protector Auditivo')),
  ('Lentes de Protección', 'Lentes de seguridad para tiro', 8000.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Lentes de Protección')),
  ('Uso de Línea (1h)', 'Uso de línea de tiro por 1 hora', 5000.00, true, NULL),
  ('Uso de Línea (2h)', 'Uso de línea de tiro por 2 horas', 8000.00, true, NULL),
  ('Entrada Visitante', 'Entrada de visitante al polígono', 3000.00, true, NULL),
  ('Kit Limpieza Armas', 'Kit completo limpieza de armas', 18000.00, true,
    (SELECT id FROM stock_items WHERE nombre = 'Kit Limpieza Armas')),
  ('Inscripción Competencia', 'Inscripción a competencia interna', 10000.00, true, NULL)
ON CONFLICT DO NOTHING;

-- =========================
-- Ventas Demo (~20 ventas, Jan-Mar 2026)
-- =========================

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
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth users found, skipping ventas seed';
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
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio1, '2026-01-05 10:30:00-03', 5500.00, v_met_efectivo, v_user_id, false, '2026-01-05 10:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 2, 250.00, 500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 2: Cliente Fernández, VISA, Jan 10
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente1, NULL, '2026-01-10 14:00:00-03', 20000.00, v_met_visa, v_user_id, false, '2026-01-10 14:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Protector Auditivo'), 1, 12000.00, 12000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Lentes de Protección'), 1, 8000.00, 8000.00);

  -- Venta 3: Socio 1002, Efectivo, Jan 15
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio2, '2026-01-15 11:00:00-03', 9700.00, v_met_efectivo, v_user_id, false, '2026-01-15 11:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 1, 4500.00, 4500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 1, 200.00, 200.00);

  -- Venta 4: Cliente López, Transferencia, Jan 20
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente2, NULL, '2026-01-20 16:00:00-03', 30000.00, v_met_transf, v_user_id, false, '2026-01-20 16:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal 9mm x50'), 2, 15000.00, 30000.00);

  -- Venta 5: Socio 1003, Efectivo, Jan 25 (ANULADA)
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio3, '2026-01-25 09:30:00-03', 3000.00, v_met_efectivo, v_user_id, true, '2026-01-25 09:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Entrada Visitante'), 1, 3000.00, 3000.00);

  -- Venta 6: Socio 1001, VISA, Feb 2
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio1, '2026-02-02 10:00:00-03', 8500.00, v_met_visa, v_user_id, false, '2026-02-02 10:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00);

  -- Venta 7: Cliente Gómez, Efectivo, Feb 8
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente3, NULL, '2026-02-08 15:30:00-03', 13000.00, v_met_efectivo, v_user_id, false, '2026-02-08 15:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (2h)'), 1, 8000.00, 8000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 8: Socio 1002, Transferencia, Feb 12
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio2, '2026-02-12 11:30:00-03', 10700.00, v_met_transf, v_user_id, false, '2026-02-12 11:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 3 Zonas'), 2, 350.00, 700.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

  -- Venta 9: Cliente Fernández, Efectivo, Feb 18
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente1, NULL, '2026-02-18 10:00:00-03', 4500.00, v_met_efectivo, v_user_id, false, '2026-02-18 10:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 1, 4500.00, 4500.00);

  -- Venta 10: Socio 1003, VISA, Feb 22
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio3, '2026-02-22 14:00:00-03', 16000.00, v_met_visa, v_user_id, false, '2026-02-22 14:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (2h)'), 1, 8000.00, 8000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Lentes de Protección'), 1, 8000.00, 8000.00);

  -- Venta 11: Cliente López, Efectivo, Feb 28
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente2, NULL, '2026-02-28 16:30:00-03', 5000.00, v_met_efectivo, v_user_id, false, '2026-02-28 16:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00);

  -- Venta 12: Socio 1001, Efectivo, Mar 1
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio1, '2026-03-01 09:00:00-03', 750.00, v_met_efectivo, v_user_id, false, '2026-03-01 09:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 1 Zona'), 1, 300.00, 300.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 1, 250.00, 250.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 1, 200.00, 200.00);

  -- Venta 13: Cliente Gómez, Transferencia, Mar 3
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente3, NULL, '2026-03-03 12:00:00-03', 18000.00, v_met_transf, v_user_id, false, '2026-03-03 12:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Kit Limpieza Armas'), 1, 18000.00, 18000.00);

  -- Venta 14: Socio 1002, Efectivo, Mar 5
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio2, '2026-03-05 10:30:00-03', 9000.00, v_met_efectivo, v_user_id, false, '2026-03-05 10:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. RD Cal 12 x25'), 2, 4500.00, 9000.00);

  -- Venta 15: Socio 1003, VISA, Mar 7
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio3, '2026-03-07 15:00:00-03', 25000.00, v_met_visa, v_user_id, false, '2026-03-07 15:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal 9mm x50'), 1, 15000.00, 15000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

  -- Venta 16: Cliente Fernández, Efectivo, Mar 8
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente1, NULL, '2026-03-08 11:00:00-03', 6000.00, v_met_efectivo, v_user_id, false, '2026-03-08 11:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Entrada Visitante'), 2, 3000.00, 6000.00);

  -- Venta 17: Socio 1001, Transferencia, Mar 10
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio1, '2026-03-10 14:30:00-03', 17000.00, v_met_transf, v_user_id, false, '2026-03-10 14:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Cart. Cal .22 LR x50'), 1, 8500.00, 8500.00);

  -- Venta 18: Cliente López, VISA, Mar 11 (ANULADA)
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente2, NULL, '2026-03-11 10:00:00-03', 12000.00, v_met_visa, v_user_id, true, '2026-03-11 10:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Protector Auditivo'), 1, 12000.00, 12000.00);

  -- Venta 19: Socio 1002, Efectivo, Mar 12
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (NULL, v_socio2, '2026-03-12 11:00:00-03', 8200.00, v_met_efectivo, v_user_id, false, '2026-03-12 11:00:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Uso de Línea (1h)'), 1, 5000.00, 5000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 50m'), 2, 220.00, 440.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 1 Zona'), 2, 300.00, 600.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Carabina Neumática'), 4, 250.00, 1000.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Pistola 25m'), 3, 200.00, 600.00),
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Blanco Fusil 3 Zonas'), 2, 280.00, 560.00);

  -- Venta 20: Cliente Gómez, Efectivo, Mar 14
  INSERT INTO ventas (cliente_id, socio_id, fecha, total, metodo_pago_id, usuario_id, anulada, created_at)
  VALUES (v_cliente3, NULL, '2026-03-14 09:30:00-03', 10000.00, v_met_efectivo, v_user_id, false, '2026-03-14 09:30:00-03')
  RETURNING id INTO v_venta_id;
  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal) VALUES
    (v_venta_id, (SELECT id FROM items_ventas WHERE nombre = 'Inscripción Competencia'), 1, 10000.00, 10000.00);

END $$;
