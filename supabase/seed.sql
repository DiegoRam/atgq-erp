-- ============================================================
-- ATGQ ERP — Seed Data
-- Task: P1.4
-- Re-runnable: uses INSERT ... ON CONFLICT DO NOTHING
-- ============================================================

-- =========================
-- Categorías Sociales (14 tipos del sistema legacy)
-- =========================

INSERT INTO categorias_sociales (nombre, descripcion, monto_base, activa) VALUES
  ('Activo', 'Socio activo regular', NULL, true),
  ('Activo-Ventanilla', 'Socio activo ingresado por ventanilla', NULL, true),
  ('Inactivo', 'Socio inactivo', NULL, true),
  ('Cadete', 'Socio cadete (menor de edad)', NULL, true),
  ('Cadete-Ventanilla', 'Socio cadete ingresado por ventanilla', NULL, true),
  ('Vitalicio', 'Socio vitalicio', NULL, true),
  ('Adherente', 'Socio adherente', NULL, true),
  ('Adherente-Ventanilla', 'Socio adherente ingresado por ventanilla', NULL, true),
  ('Honorario', 'Socio honorario', NULL, true),
  ('Grupo Familia', 'Titular de grupo familiar', NULL, true),
  ('Grupo Familiar-Ventanilla', 'Titular de grupo familiar por ventanilla', NULL, true),
  ('Grupo Fliar. Miembro', 'Miembro de grupo familiar', NULL, true),
  ('Grupo Fliar. Miembro-Ventanilla', 'Miembro de grupo familiar por ventanilla', NULL, true),
  ('BAJA', 'Socio dado de baja', NULL, true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Métodos de Cobranza
-- =========================

INSERT INTO metodos_cobranza (nombre, activo) VALUES
  ('Efectivo', true),
  ('VISA Crédito', true),
  ('VISA Débito', true),
  ('Mastercard', true),
  ('Transferencia Bancaria', true),
  ('Débito Automático', true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Tipos de Cuotas
-- =========================

INSERT INTO tipos_cuotas (nombre, descripcion, activo) VALUES
  ('Cuota Social', 'Cuota mensual de socio', true),
  ('Cuota Actividad', 'Cuota por actividad inscripta', true),
  ('Cuota Especial', 'Cuota especial o extraordinaria', true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Roles del Sistema
-- =========================

INSERT INTO roles (nombre, descripcion) VALUES
  ('Administrador', 'Acceso total al sistema'),
  ('Tesorero', 'Gestión de tesorería, ventas y stock'),
  ('Recepcionista', 'Gestión de socios, turnos y consulta de ventas'),
  ('Solo Lectura', 'Consulta de todos los módulos sin modificación')
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Permisos por Rol
-- =========================

-- Módulos del sistema
-- socios, actividades, turnos, ventas, stock, tesoreria, seguridad

-- Administrador: acceso total a todos los módulos
INSERT INTO permisos_modulo (rol_id, modulo, puede_leer, puede_escribir, puede_eliminar)
SELECT r.id, m.modulo, true, true, true
FROM roles r
CROSS JOIN (VALUES
  ('socios'), ('actividades'), ('turnos'), ('ventas'), ('stock'), ('tesoreria'), ('seguridad')
) AS m(modulo)
WHERE r.nombre = 'Administrador'
ON CONFLICT (rol_id, modulo) DO NOTHING;

-- Tesorero: escribe en tesoreria/ventas/stock, lee socios y resto
INSERT INTO permisos_modulo (rol_id, modulo, puede_leer, puede_escribir, puede_eliminar)
SELECT r.id, m.modulo, m.leer, m.escribir, m.eliminar
FROM roles r
CROSS JOIN (VALUES
  ('socios',      true, false, false),
  ('actividades', true, false, false),
  ('turnos',      true, false, false),
  ('ventas',      true, true,  false),
  ('stock',       true, true,  false),
  ('tesoreria',   true, true,  true),
  ('seguridad',   false, false, false)
) AS m(modulo, leer, escribir, eliminar)
WHERE r.nombre = 'Tesorero'
ON CONFLICT (rol_id, modulo) DO NOTHING;

-- Recepcionista: escribe socios/turnos, lee ventas y resto
INSERT INTO permisos_modulo (rol_id, modulo, puede_leer, puede_escribir, puede_eliminar)
SELECT r.id, m.modulo, m.leer, m.escribir, m.eliminar
FROM roles r
CROSS JOIN (VALUES
  ('socios',      true, true,  false),
  ('actividades', true, false, false),
  ('turnos',      true, true,  false),
  ('ventas',      true, false, false),
  ('stock',       true, false, false),
  ('tesoreria',   true, false, false),
  ('seguridad',   false, false, false)
) AS m(modulo, leer, escribir, eliminar)
WHERE r.nombre = 'Recepcionista'
ON CONFLICT (rol_id, modulo) DO NOTHING;

-- Solo Lectura: lee todo, no escribe ni elimina
INSERT INTO permisos_modulo (rol_id, modulo, puede_leer, puede_escribir, puede_eliminar)
SELECT r.id, m.modulo, true, false, false
FROM roles r
CROSS JOIN (VALUES
  ('socios'), ('actividades'), ('turnos'), ('ventas'), ('stock'), ('tesoreria'), ('seguridad')
) AS m(modulo)
WHERE r.nombre = 'Solo Lectura'
ON CONFLICT (rol_id, modulo) DO NOTHING;

-- =========================
-- Depósito Inicial
-- =========================

INSERT INTO depositos (nombre, descripcion, activo) VALUES
  ('Deposito Central', 'Depósito principal del club', true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Categorías de Movimientos de Tesorería
-- =========================

-- Ingresos
INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Cuotas Socios', 'ingreso', true),
  ('Ventas', 'ingreso', true),
  ('Actividades', 'ingreso', true),
  ('Otros Ingresos', 'ingreso', true)
ON CONFLICT (nombre, tipo) DO NOTHING;

-- Egresos
INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Servicios', 'egreso', true),
  ('Mantenimiento', 'egreso', true),
  ('Sueldos', 'egreso', true),
  ('Compras', 'egreso', true),
  ('Otros Egresos', 'egreso', true)
ON CONFLICT (nombre, tipo) DO NOTHING;

-- =========================
-- Instalaciones para Turnos
-- =========================

INSERT INTO instalaciones (nombre, descripcion, activa) VALUES
  ('Cancha Tiro', 'Cancha de tiro principal', true),
  ('Gimnasio', 'Gimnasio del club', true),
  ('Salón Principal', 'Salón de eventos principal', true)
ON CONFLICT (nombre) DO NOTHING;
