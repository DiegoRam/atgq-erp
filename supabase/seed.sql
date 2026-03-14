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

-- Transferencias (usadas internamente para transferencias entre cajas)
INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Transferencia', 'ingreso', true),
  ('Transferencia', 'egreso', true)
ON CONFLICT (nombre, tipo) DO NOTHING;

-- =========================
-- Cajas de Tesorería
-- =========================

INSERT INTO cajas (nombre, descripcion, saldo_inicial, activa) VALUES
  ('Caja Principal', 'Caja principal del club', 50000.00, true),
  ('Caja Chica', 'Gastos menores diarios', 5000.00, true),
  ('Caja Actividades', 'Ingresos por actividades deportivas', 10000.00, true)
ON CONFLICT (nombre) DO NOTHING;

-- =========================
-- Instalaciones para Turnos
-- =========================

INSERT INTO instalaciones (nombre, descripcion, activa) VALUES
  ('Cancha Tiro', 'Cancha de tiro principal', true),
  ('Gimnasio', 'Gimnasio del club', true),
  ('Salón Principal', 'Salón de eventos principal', true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- DEMO DATA — Socios, Grupo Familiar, Cuotas
-- ============================================================

-- =========================
-- Grupo Familiar (crear primero sin titular, se actualiza después)
-- =========================

INSERT INTO grupos_familiares (id, titular_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', NULL);

-- =========================
-- Socios de Demostración (~50)
-- =========================

INSERT INTO socios (nro_socio, apellido, nombre, dni, categoria_id, fecha_alta, fecha_baja, metodo_cobranza_id, grupo_familiar_id, localidad, fecha_nacimiento)
VALUES
  -- Activos (25)
  (1,  'González',    'Carlos Alberto',  '28456789', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-03-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1976-05-12'),
  (2,  'Rodríguez',   'María Laura',     '32789012', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2016-07-22', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Bernal', '1985-11-03'),
  (3,  'Martínez',    'Juan Pablo',       '25678901', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-01-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Quilmes', '1970-02-28'),
  (4,  'López',       'Ana Carolina',     '35123456', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2018-04-05', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Crédito'), NULL, 'Berazategui', '1990-08-17'),
  (5,  'García',      'Roberto Daniel',   '27890123', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2017-09-12', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1974-12-01'),
  (6,  'Fernández',   'Lucía Belén',      '33456789', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2019-02-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Mastercard'), NULL, 'Wilde', '1988-06-25'),
  (7,  'Díaz',        'Marcelo Hugo',     '26345678', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2016-11-30', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Avellaneda', '1972-09-14'),
  (8,  'Pérez',       'Valentina',        '38901234', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-06-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1995-03-22'),
  (9,  'Sánchez',     'Diego Armando',    '29567890', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-08-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Débito'), NULL, 'Bernal', '1978-10-30'),
  (10, 'Romero',      'Patricia Alejandra','31234567', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2017-03-18', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Quilmes', '1982-07-09'),
  (11, 'Torres',      'Gustavo Adrián',   '24901234', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-05-25', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Berazategui', '1968-01-15'),
  (12, 'Álvarez',     'Camila Sofía',     '37678901', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2021-01-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Quilmes', '1993-04-18'),
  (13, 'Ruiz',        'Fernando Javier',  '30012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2016-12-05', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Mastercard'), NULL, 'Wilde', '1980-11-27'),
  (14, 'Acosta',      'Florencia Micaela','36789012', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-03-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Crédito'), NULL, 'Avellaneda', '1992-02-14'),
  (15, 'Medina',      'Ramón Oscar',      '23456789', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-10-08', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1965-08-06'),
  (16, 'Herrera',     'Julieta Paz',      '39012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2022-05-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Bernal', '1998-12-30'),
  (17, 'Molina',      'Pablo Sebastián',  '28012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2017-07-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Débito'), NULL, 'Quilmes', '1975-06-11'),
  (18, 'Morales',     'Daniela Noemi',    '34567890', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2019-11-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Berazategui', '1989-09-03'),
  (19, 'Suárez',      'Martín Ignacio',   '31890123', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2018-02-14', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1983-05-20'),
  (20, 'Castro',      'Romina Alejandra', '33012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2019-08-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Mastercard'), NULL, 'Wilde', '1987-01-08'),
  (21, 'Vargas',      'Leandro Nicolás',  '30567890', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2017-04-22', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Avellaneda', '1981-03-16'),
  (22, 'Gómez',       'Natalia Andrea',   '35890123', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2020-09-05', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Crédito'), NULL, 'Quilmes', '1991-07-24'),
  (23, 'Ríos',        'Eduardo César',    '26890123', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2016-06-18', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Bernal', '1973-10-05'),
  (24, 'Aguirre',     'Soledad María',    '37012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2021-07-30', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Quilmes', '1994-04-12'),
  (25, 'Cabrera',     'Héctor Manuel',    '25012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2015-12-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Berazategui', '1969-11-22'),

  -- Cadetes (5)
  (26, 'Peralta',     'Tomás Agustín',    '45123456', (SELECT id FROM categorias_sociales WHERE nombre='Cadete'), '2023-03-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '2010-01-20'),
  (27, 'Sosa',        'Valentín',         '46234567', (SELECT id FROM categorias_sociales WHERE nombre='Cadete'), '2023-06-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Bernal', '2011-05-14'),
  (28, 'Benítez',     'Catalina',         '47345678', (SELECT id FROM categorias_sociales WHERE nombre='Cadete'), '2024-02-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Quilmes', '2012-08-30'),
  (29, 'Miranda',     'Santiago',         '48456789', (SELECT id FROM categorias_sociales WHERE nombre='Cadete'), '2024-05-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Wilde', '2013-03-07'),
  (30, 'Rojas',       'Milagros',         '44012345', (SELECT id FROM categorias_sociales WHERE nombre='Cadete'), '2022-11-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Débito'), NULL, 'Quilmes', '2009-12-15'),

  -- Vitalicios (3)
  (31, 'Paz',         'Alberto Enrique',  '12345678', (SELECT id FROM categorias_sociales WHERE nombre='Vitalicio'), '2015-01-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1945-04-25'),
  (32, 'Mansilla',    'Jorge Luis',       '14567890', (SELECT id FROM categorias_sociales WHERE nombre='Vitalicio'), '2015-01-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Bernal', '1950-09-18'),
  (33, 'Ledesma',     'Raúl Osvaldo',     '16789012', (SELECT id FROM categorias_sociales WHERE nombre='Vitalicio'), '2015-01-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1948-07-02'),

  -- Adherentes (5)
  (34, 'Núñez',       'Claudia Beatriz',  '29123456', (SELECT id FROM categorias_sociales WHERE nombre='Adherente'), '2018-09-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Avellaneda', '1977-03-11'),
  (35, 'Ojeda',       'Maximiliano',      '34012345', (SELECT id FROM categorias_sociales WHERE nombre='Adherente'), '2020-01-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Mastercard'), NULL, 'Quilmes', '1988-10-05'),
  (36, 'Domínguez',   'Silvia Mabel',     '27012345', (SELECT id FROM categorias_sociales WHERE nombre='Adherente'), '2017-05-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Berazategui', '1973-06-20'),
  (37, 'Figueroa',    'Cristian Darío',   '32012345', (SELECT id FROM categorias_sociales WHERE nombre='Adherente'), '2019-03-08', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Crédito'), NULL, 'Quilmes', '1984-12-17'),
  (38, 'Luna',        'Mariana Sol',      '36012345', (SELECT id FROM categorias_sociales WHERE nombre='Adherente'), '2021-06-25', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), NULL, 'Wilde', '1992-05-29'),

  -- Grupo Familia — Titular (1) + Miembros (3)
  (39, 'Ortega',      'Ricardo Fabián',   '26012345', (SELECT id FROM categorias_sociales WHERE nombre='Grupo Familia'), '2018-01-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), 'a0000000-0000-0000-0000-000000000001', 'Quilmes', '1972-04-08'),
  (40, 'Ortega',      'Gabriela Inés',    '27456789', (SELECT id FROM categorias_sociales WHERE nombre='Grupo Fliar. Miembro'), '2018-01-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), 'a0000000-0000-0000-0000-000000000001', 'Quilmes', '1975-09-22'),
  (41, 'Ortega',      'Facundo',          '46012345', (SELECT id FROM categorias_sociales WHERE nombre='Grupo Fliar. Miembro'), '2018-01-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), 'a0000000-0000-0000-0000-000000000001', 'Quilmes', '2008-11-15'),
  (42, 'Ortega',      'Luciana',          '48012345', (SELECT id FROM categorias_sociales WHERE nombre='Grupo Fliar. Miembro'), '2018-01-10', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Débito Automático'), 'a0000000-0000-0000-0000-000000000001', 'Quilmes', '2012-06-03'),

  -- Inactivos (3)
  (43, 'Vega',        'Sergio Raúl',      '24012345', (SELECT id FROM categorias_sociales WHERE nombre='Inactivo'), '2015-06-01', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1967-02-18'),
  (44, 'Ponce',       'Liliana María',    '28890123', (SELECT id FROM categorias_sociales WHERE nombre='Inactivo'), '2016-03-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Bernal', '1976-08-14'),
  (45, 'Carrizo',     'Ariel Omar',       '30890123', (SELECT id FROM categorias_sociales WHERE nombre='Inactivo'), '2017-10-05', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Transferencia Bancaria'), NULL, 'Avellaneda', '1980-05-30'),

  -- BAJA (2)
  (46, 'Quiroga',     'Néstor Fabián',    '22345678', (SELECT id FROM categorias_sociales WHERE nombre='BAJA'), '2015-02-01', '2023-08-15', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Quilmes', '1960-11-09'),
  (47, 'Ibáñez',      'Sandra Patricia',  '25890123', (SELECT id FROM categorias_sociales WHERE nombre='BAJA'), '2016-09-10', '2024-03-01', (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Berazategui', '1970-07-25'),

  -- Extra activos para llegar a 50
  (48, 'Villalba',    'Andrés Nicolás',   '31567890', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2018-10-15', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='VISA Crédito'), NULL, 'Quilmes', '1983-09-12'),
  (49, 'Córdoba',     'Emilia Rocío',     '38012345', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2022-02-28', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Mastercard'), NULL, 'Bernal', '1996-01-07'),
  (50, 'Escobar',     'Jorge Alejandro',  '29890123', (SELECT id FROM categorias_sociales WHERE nombre='Activo'), '2017-06-20', NULL, (SELECT id FROM metodos_cobranza WHERE nombre='Efectivo'), NULL, 'Wilde', '1979-04-30')
ON CONFLICT (nro_socio) DO NOTHING;

-- =========================
-- Actualizar titular del grupo familiar
-- =========================

UPDATE grupos_familiares
SET titular_id = (SELECT id FROM socios WHERE nro_socio = 39)
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- =========================
-- Cuotas de Demostración (~150 registros)
-- 3 meses: enero, febrero, marzo 2026
-- Para socios activos (1-25, 48-50) = 28 socios × 3 meses
-- Variamos: pagadas/impagas, métodos de pago
-- =========================

-- ENERO 2026 — Todas pagadas
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  '2026-01-01',
  4500.00,
  '2026-01-10 10:00:00-03',
  true,
  s.metodo_cobranza_id
FROM socios s
WHERE s.nro_socio IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,48,49,50)
ON CONFLICT DO NOTHING;

-- FEBRERO 2026 — Mayoría pagadas, 5 impagas (morosos)
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  '2026-02-01',
  4500.00,
  '2026-02-12 10:00:00-03',
  true,
  s.metodo_cobranza_id
FROM socios s
WHERE s.nro_socio IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23)
ON CONFLICT DO NOTHING;

-- Febrero impagas (socios 24,25,48,49,50)
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  '2026-02-01',
  4500.00,
  NULL,
  false,
  NULL
FROM socios s
WHERE s.nro_socio IN (24,25,48,49,50)
ON CONFLICT DO NOTHING;

-- MARZO 2026 — Pocas pagadas, mayoría impaga (mes en curso)
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  '2026-03-01',
  4500.00,
  '2026-03-05 10:00:00-03',
  true,
  s.metodo_cobranza_id
FROM socios s
WHERE s.nro_socio IN (1,2,3,4,5,6,7,8)
ON CONFLICT DO NOTHING;

-- Marzo impagas (socios 9-25, 48-50)
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  '2026-03-01',
  4500.00,
  NULL,
  false,
  NULL
FROM socios s
WHERE s.nro_socio IN (9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,48,49,50)
ON CONFLICT DO NOTHING;

-- Cuotas para grupo familiar (titular + miembros) — 3 meses
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  p.periodo,
  CASE WHEN s.nro_socio = 39 THEN 4500.00 ELSE 2500.00 END,
  CASE WHEN p.periodo <= '2026-02-01' THEN p.periodo + interval '10 days' ELSE NULL END,
  p.periodo <= '2026-02-01',
  CASE WHEN p.periodo <= '2026-02-01' THEN s.metodo_cobranza_id ELSE NULL END
FROM socios s
CROSS JOIN (VALUES ('2026-01-01'::date), ('2026-02-01'::date), ('2026-03-01'::date)) AS p(periodo)
WHERE s.nro_socio IN (39, 40, 41, 42)
ON CONFLICT DO NOTHING;

-- =========================
-- Movimientos de Fondos de Demostración (~30)
-- Distribuidos en Ene-Mar 2026 entre las 3 cajas
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

-- Cuotas para cadetes — 3 meses (todas pagadas excepto marzo)
INSERT INTO cuotas (socio_id, tipo_cuota_id, periodo, monto, fecha_pago, pagada, metodo_pago_id)
SELECT
  s.id,
  (SELECT id FROM tipos_cuotas WHERE nombre='Cuota Social'),
  p.periodo,
  3000.00,
  CASE WHEN p.periodo <= '2026-02-01' THEN p.periodo + interval '10 days' ELSE NULL END,
  p.periodo <= '2026-02-01',
  CASE WHEN p.periodo <= '2026-02-01' THEN s.metodo_cobranza_id ELSE NULL END
FROM socios s
CROSS JOIN (VALUES ('2026-01-01'::date), ('2026-02-01'::date), ('2026-03-01'::date)) AS p(periodo)
WHERE s.nro_socio IN (26, 27, 28, 29, 30)
ON CONFLICT DO NOTHING;
