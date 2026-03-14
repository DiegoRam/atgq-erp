-- ============================================================
-- TESORERÍA Seed Data
-- Task: P4.1, P4.2, P4.4
-- Re-runnable: uses ON CONFLICT DO NOTHING
-- ============================================================

-- =========================
-- Categorías de Transferencia (para P4.4)
-- =========================

INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Transferencia', 'ingreso', true),
  ('Transferencia', 'egreso', true)
ON CONFLICT (nombre, tipo) DO NOTHING;

-- =========================
-- Cajas de Tesorería (P4.1)
-- =========================

INSERT INTO cajas (nombre, descripcion, saldo_inicial, activa) VALUES
  ('Caja Principal', 'Caja principal del club', 50000.00, true),
  ('Caja Chica', 'Gastos menores diarios', 5000.00, true),
  ('Caja Actividades', 'Ingresos por actividades deportivas', 10000.00, true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Movimientos de Fondos Demo (~30) (P4.2)
-- =========================

DO $$
DECLARE
  v_user_id UUID;
  v_caja_principal UUID;
  v_caja_chica UUID;
  v_caja_actividades UUID;
  v_cat_cuotas UUID;
  v_cat_ventas UUID;
  v_cat_actividades UUID;
  v_cat_otros_ing UUID;
  v_cat_servicios UUID;
  v_cat_mantenimiento UUID;
  v_cat_sueldos UUID;
  v_cat_compras UUID;
  v_cat_otros_egr UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth users found, skipping movimientos seed';
    RETURN;
  END IF;

  SELECT id INTO v_caja_principal FROM cajas WHERE nombre = 'Caja Principal';
  SELECT id INTO v_caja_chica FROM cajas WHERE nombre = 'Caja Chica';
  SELECT id INTO v_caja_actividades FROM cajas WHERE nombre = 'Caja Actividades';

  SELECT id INTO v_cat_cuotas FROM categorias_movimientos WHERE nombre = 'Cuotas Socios' AND tipo = 'ingreso';
  SELECT id INTO v_cat_ventas FROM categorias_movimientos WHERE nombre = 'Ventas' AND tipo = 'ingreso';
  SELECT id INTO v_cat_actividades FROM categorias_movimientos WHERE nombre = 'Actividades' AND tipo = 'ingreso';
  SELECT id INTO v_cat_otros_ing FROM categorias_movimientos WHERE nombre = 'Otros Ingresos' AND tipo = 'ingreso';
  SELECT id INTO v_cat_servicios FROM categorias_movimientos WHERE nombre = 'Servicios' AND tipo = 'egreso';
  SELECT id INTO v_cat_mantenimiento FROM categorias_movimientos WHERE nombre = 'Mantenimiento' AND tipo = 'egreso';
  SELECT id INTO v_cat_sueldos FROM categorias_movimientos WHERE nombre = 'Sueldos' AND tipo = 'egreso';
  SELECT id INTO v_cat_compras FROM categorias_movimientos WHERE nombre = 'Compras' AND tipo = 'egreso';
  SELECT id INTO v_cat_otros_egr FROM categorias_movimientos WHERE nombre = 'Otros Egresos' AND tipo = 'egreso';

  -- ENERO 2026 — Caja Principal
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_principal, v_cat_cuotas, 'ingreso', 126000.00, 'Cuotas socios enero (28 socios)', '2026-01-10 10:00:00-03', v_user_id),
    (v_caja_principal, v_cat_ventas, 'ingreso', 45000.00, 'Ventas mostrador enero', '2026-01-15 14:00:00-03', v_user_id),
    (v_caja_principal, v_cat_servicios, 'egreso', 35000.00, 'Electricidad enero', '2026-01-20 09:00:00-03', v_user_id),
    (v_caja_principal, v_cat_sueldos, 'egreso', 180000.00, 'Sueldos enero', '2026-01-31 12:00:00-03', v_user_id),
    (v_caja_principal, v_cat_mantenimiento, 'egreso', 22000.00, 'Reparación techo cancha', '2026-01-25 11:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- ENERO 2026 — Caja Chica
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_chica, v_cat_compras, 'egreso', 3500.00, 'Artículos de limpieza', '2026-01-12 10:00:00-03', v_user_id),
    (v_caja_chica, v_cat_otros_egr, 'egreso', 1200.00, 'Envío encomienda', '2026-01-18 15:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- ENERO 2026 — Caja Actividades
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_actividades, v_cat_actividades, 'ingreso', 28000.00, 'Inscripción tiro enero', '2026-01-08 09:00:00-03', v_user_id),
    (v_caja_actividades, v_cat_actividades, 'ingreso', 15000.00, 'Inscripción gimnasio enero', '2026-01-10 10:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- FEBRERO 2026 — Caja Principal
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_principal, v_cat_cuotas, 'ingreso', 103500.00, 'Cuotas socios febrero (23 socios)', '2026-02-12 10:00:00-03', v_user_id),
    (v_caja_principal, v_cat_ventas, 'ingreso', 38000.00, 'Ventas mostrador febrero', '2026-02-14 14:00:00-03', v_user_id),
    (v_caja_principal, v_cat_otros_ing, 'ingreso', 12000.00, 'Alquiler salón evento', '2026-02-22 16:00:00-03', v_user_id),
    (v_caja_principal, v_cat_servicios, 'egreso', 37000.00, 'Electricidad + gas febrero', '2026-02-20 09:00:00-03', v_user_id),
    (v_caja_principal, v_cat_sueldos, 'egreso', 180000.00, 'Sueldos febrero', '2026-02-28 12:00:00-03', v_user_id),
    (v_caja_principal, v_cat_compras, 'egreso', 15000.00, 'Cartuchos y blancos', '2026-02-18 11:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- FEBRERO 2026 — Caja Chica
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_chica, v_cat_compras, 'egreso', 2800.00, 'Café y galletitas', '2026-02-10 10:00:00-03', v_user_id),
    (v_caja_chica, v_cat_otros_egr, 'egreso', 800.00, 'Fotocopias', '2026-02-15 14:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- FEBRERO 2026 — Caja Actividades
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_actividades, v_cat_actividades, 'ingreso', 32000.00, 'Inscripción tiro febrero', '2026-02-05 09:00:00-03', v_user_id),
    (v_caja_actividades, v_cat_actividades, 'ingreso', 18000.00, 'Inscripción gimnasio febrero', '2026-02-07 10:00:00-03', v_user_id),
    (v_caja_actividades, v_cat_mantenimiento, 'egreso', 8000.00, 'Mantenimiento equipos gimnasio', '2026-02-20 11:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- MARZO 2026 — Caja Principal
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_principal, v_cat_cuotas, 'ingreso', 36000.00, 'Cuotas socios marzo (8 pagaron)', '2026-03-05 10:00:00-03', v_user_id),
    (v_caja_principal, v_cat_ventas, 'ingreso', 22000.00, 'Ventas mostrador marzo', '2026-03-08 14:00:00-03', v_user_id),
    (v_caja_principal, v_cat_servicios, 'egreso', 38000.00, 'Electricidad + agua marzo', '2026-03-12 09:00:00-03', v_user_id),
    (v_caja_principal, v_cat_mantenimiento, 'egreso', 45000.00, 'Pintura cancha de tiro', '2026-03-10 11:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- MARZO 2026 — Caja Chica
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_chica, v_cat_compras, 'egreso', 4200.00, 'Artículos varios', '2026-03-07 10:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;

  -- MARZO 2026 — Caja Actividades
  INSERT INTO movimientos_fondos (caja_id, categoria_id, tipo, monto, descripcion, fecha, usuario_id) VALUES
    (v_caja_actividades, v_cat_actividades, 'ingreso', 25000.00, 'Inscripción tiro marzo', '2026-03-03 09:00:00-03', v_user_id),
    (v_caja_actividades, v_cat_actividades, 'ingreso', 12000.00, 'Inscripción gimnasio marzo', '2026-03-05 10:00:00-03', v_user_id)
  ON CONFLICT DO NOTHING;
END $$;
