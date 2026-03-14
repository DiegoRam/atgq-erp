-- ============================
-- SEED: Actividades + Turnos
-- ============================

-- Actividades
INSERT INTO actividades (nombre, descripcion, monto_cuota, activa) VALUES
  ('Tiro Deportivo', 'Práctica de tiro deportivo con instructor', 15000, true),
  ('Gimnasia', 'Clases de gimnasia general', 10000, true),
  ('Natación', 'Clases de natación en pileta del club', 12000, true),
  ('Defensa Personal', 'Curso de defensa personal', 8000, true),
  ('Yoga', 'Clases de yoga y meditación', 5000, true)
ON CONFLICT DO NOTHING;

-- Actividades Extras
INSERT INTO actividades_extras (nombre, descripcion, fecha, monto) VALUES
  ('Torneo de Tiro Primavera', 'Torneo anual de tiro deportivo', '2026-04-15', 5000),
  ('Jornada Puertas Abiertas', 'Jornada abierta al público con actividades gratuitas', '2026-05-10', 0),
  ('Curso Primeros Auxilios', 'Curso intensivo de primeros auxilios y RCP', '2026-03-20', 3000),
  ('Campeonato Interclubs', 'Campeonato de tiro entre clubes de la zona', '2026-06-01', 8000)
ON CONFLICT DO NOTHING;

-- Inscripciones de socios en actividades + Turnos
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
