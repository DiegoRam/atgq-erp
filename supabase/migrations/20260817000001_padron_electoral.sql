-- ============================================================
-- Padrón electoral — socios habilitados a votar en asamblea
--
-- El club necesita emitir la lista de socios con derecho a voto: categoría
-- habilitada + 18 años cumplidos + 1 año de antigüedad + al día de cuota
-- social. Hasta ahora no existía forma de sacarla.
--
-- De paso corrige dos defectos de /socios/padron:
--  1. El listado se truncaba en 1000 filas en silencio (PostgREST max_rows).
--     Con ~8.400 socios, la pantalla mostraba, contaba, exportaba e imprimía
--     menos de un octavo del club. Un padrón truncado no es incompleto: es
--     falso. Se arregla en el server action, paginando con fetchAllRows.
--  2. Filtraba los activos por el nombre literal 'BAJA' en vez de por
--     categorias_sociales.cuenta_como_activo — que es el predicado canónico
--     desde 20260806000001_dashboard_metrics.sql. Por eso el padrón incluía
--     a los socios en categoría 'Inactivo'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dos banderas editables, no nombres hardcodeados
--
-- Mismo patrón que cuenta_como_activo (20260806000001): seed por nombre una
-- sola vez, no lookup en runtime. Los nombres de categoría vienen migrados del
-- legacy y son editables desde el CRUD, así que un typo corregido desde la UI
-- rompería el padrón en silencio, sin error, hasta el día de la asamblea.
-- ------------------------------------------------------------

-- DEFAULT false (al revés que cuenta_como_activo): un padrón electoral falla
-- cerrado. Una categoría creada mañana no otorga voto por omisión.
ALTER TABLE categorias_sociales
  ADD COLUMN IF NOT EXISTS habilita_voto BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN categorias_sociales.habilita_voto IS
  'Si los socios de esta categoría están habilitados a votar en asamblea. '
  'Es una de las cuatro condiciones del padrón electoral (ver get_padron): '
  'categoría habilitada + 18 años cumplidos + 1 año de antigüedad + al día de cuota social.';

-- Seed inicial por nombre (una sola vez, no es un lookup en runtime).
-- Las 8 categorías las fijó el club el 2026-08-17.
UPDATE categorias_sociales SET habilita_voto = true
WHERE upper(btrim(nombre)) IN (
  'ACTIVO', 'ACTIVO-VENTANILLA',
  'GRUPO FAMILIA', 'GRUPO FAMILIAR-VENTANILLA',
  'GRUPO FLIAR. MIEMBRO', 'GRUPO FLIAR. MIEMBRO-VENTANILLA',
  'VITALICIO', 'HONORARIO'
);

-- El seed por nombre tiene que fallar ruidoso: si en la base destino los
-- nombres difieren (la migración del legacy MySQL está pendiente), un UPDATE
-- de 0 filas aplica "OK" y deja el padrón electoral vacío sin ningún error.
-- Es exactamente el modo de falla silenciosa que estas banderas existen para
-- evitar, sólo que corrido de la UI al deploy.
DO $$ BEGIN
  IF (SELECT count(*) FROM categorias_sociales WHERE habilita_voto) = 0 THEN
    RAISE EXCEPTION 'seed de habilita_voto no matcheó ninguna categoría: revisar nombres';
  END IF;
END $$;

ALTER TABLE tipos_cuotas
  ADD COLUMN IF NOT EXISTS afecta_padron BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tipos_cuotas.afecta_padron IS
  'Si una cuota impaga de este tipo inhabilita a votar en asamblea. '
  'Sólo la cuota social; las de actividad y las especiales no.';

UPDATE tipos_cuotas SET afecta_padron = true
WHERE upper(btrim(nombre)) = 'CUOTA SOCIAL';

-- Ídem: sin ningún tipo marcado, el criterio "al día" desaparece en silencio y
-- el padrón habilita a todo moroso.
DO $$ BEGIN
  IF (SELECT count(*) FROM tipos_cuotas WHERE afecta_padron) = 0 THEN
    RAISE EXCEPTION 'seed de afecta_padron no matcheó ningún tipo de cuota: revisar nombres';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Índices
--
-- El predicado de "al día" es un anti-join sobre impagas.
-- idx_cuotas_socio_periodo existe pero recorre también las pagadas (mayoría).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cuotas_impagas_socio_periodo
  ON cuotas (socio_id, periodo) WHERE pagada = false;

CREATE INDEX IF NOT EXISTS idx_cuotas_tipo_periodo
  ON cuotas (tipo_cuota_id, periodo DESC);

-- ------------------------------------------------------------
-- 3. Período de corte — una sola definición, tres consumidores
--
-- Helper interno (sin guard de permisos): lo llaman get_padron y
-- get_padron_periodo_corte, que sí lo tienen. Sin EXECUTE para PUBLIC/anon/
-- authenticated, así que no es alcanzable sin pasar por uno de los dos.
--
-- El `periodo <= mes en curso` es el arreglo de un bug con dientes: v_corte es
-- global al club, así que UNA cuota social con período futuro —un typo de año
-- en el input libre de socios/cuotas/generar, o una emisión adelantada— movía
-- el corte de TODOS. Medido sobre el seed local: una sola cuota en 2030-01
-- hacía caer el padrón de 28 a 11 habilitados (-61%), sin ningún error. El
-- tope al mes en curso lo neutraliza.
--
-- Deliberadamente NO es un corte por socio: sería más robusto todavía, pero
-- cambia la semántica que el club aprobó y abre otro agujero (un socio con una
-- única cuota vieja impaga pasaría a estar habilitado). Es decisión del
-- usuario, no nuestra.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION padron_periodo_corte()
RETURNS date
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT max(c.periodo)
    FROM cuotas c JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
   WHERE tc.afecta_padron
     AND c.periodo <= date_trunc('month', current_date)::date;
$$;

COMMENT ON FUNCTION padron_periodo_corte() IS
  'Último período de cuota social emitido, acotado al mes en curso. Es el corte '
  'del criterio "al día" del padrón electoral. Helper interno: usar '
  'get_padron_periodo_corte(), que valida permisos.';

REVOKE EXECUTE ON FUNCTION padron_periodo_corte() FROM PUBLIC, anon, authenticated;

-- Versión pública. La pantalla necesita el corte AUNQUE el listado devuelva 0
-- filas: leerlo de la primera fila hacía que un filtro sin resultados imprimiera
-- "sin cuotas sociales emitidas a la fecha", una afirmación falsa en una hoja
-- que se firma.
CREATE OR REPLACE FUNCTION get_padron_periodo_corte()
RETURNS date
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT permiso_modulo_todos_los_roles('socios', 'leer') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  RETURN padron_periodo_corte();
END;
$$;

REVOKE EXECUTE ON FUNCTION get_padron_periodo_corte() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_padron_periodo_corte() TO authenticated;

-- ------------------------------------------------------------
-- 4. RPC get_padron
--
-- SECURITY DEFINER con guard explícito, no INVOKER: el criterio de "al día" es
-- un NOT EXISTS sobre cuotas. Con INVOKER, la RLS de cuotas filtra esa
-- subconsulta, y un usuario que pueda leer socios pero no cuotas vería a todo
-- el club como habilitado, sin error. Hoy ambas policies dependen del mismo
-- permiso socios:leer, pero esa coincidencia no es un invariante.
--
-- Trampa de plpgsql: los nombres del RETURNS TABLE son variables y colisionan
-- con las columnas homónimas (id, nombre, habilita_voto). Toda referencia va
-- calificada (s.id, b.habilita_voto, cs.nombre AS categoria).
-- ------------------------------------------------------------

-- CREATE OR REPLACE no puede cambiar el tipo de retorno: al iterar sobre el
-- RETURNS TABLE hay que dropear primero.
DROP FUNCTION IF EXISTS get_padron(uuid, boolean);

CREATE FUNCTION get_padron(
  p_categoria_id     uuid    DEFAULT NULL,
  p_solo_habilitados boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, nro_socio integer, apellido text, nombre text, dni text,
  categoria_id uuid, categoria text, fecha_alta date, localidad text,
  fecha_nacimiento date, edad integer, antiguedad_anios integer,
  habilita_voto boolean, cuotas_sociales_emitidas bigint, periodo_corte date
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Último período de cuota social EMITIDO. Esa cuota se tolera impaga
  -- (recién emitida, puede no haber vencido); las anteriores no.
  -- Si el club nunca emitió cuota social, v_corte queda NULL y `c.periodo <
  -- v_corte` nunca da true: nadie queda inhabilitado por deuda. Es correcto
  -- —no se reclama una cuota que no se emitió— pero en ese escenario el
  -- padrón colapsa a "categoría + edad + antigüedad".
  v_corte date;
BEGIN
  IF NOT permiso_modulo_todos_los_roles('socios', 'leer') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  v_corte := padron_periodo_corte();

  RETURN QUERY
  WITH emitidas AS (
    -- Agregado en una pasada, no subconsulta correlacionada: con 8.400
    -- socios serían 8.400 lookups. Se expone para poder auditar a quienes
    -- pasan "al día" por no tener cuotas, no por haber pagado.
    SELECT c.socio_id, count(*) AS n
      FROM cuotas c JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
     WHERE tc.afecta_padron GROUP BY c.socio_id
  ),
  base AS (
    SELECT s.id, s.nro_socio, s.apellido, s.nombre, s.dni, s.categoria_id,
           cs.nombre AS categoria, s.fecha_alta, s.localidad, s.fecha_nacimiento,
           -- age() y no resta de días: años cumplidos, con bisiestos.
           CASE WHEN s.fecha_nacimiento IS NULL THEN NULL
                ELSE extract(year FROM age(current_date, s.fecha_nacimiento))::int
           END AS edad,
           extract(year FROM age(current_date, s.fecha_alta))::int AS antiguedad_anios,
           cs.habilita_voto,
           coalesce(e.n, 0) AS cuotas_sociales_emitidas
      FROM socios s
      JOIN categorias_sociales cs ON cs.id = s.categoria_id
      LEFT JOIN emitidas e ON e.socio_id = s.id
     WHERE s.fecha_baja IS NULL
       -- cuenta_como_activo y no `nombre <> 'BAJA'`: el filtro por nombre
       -- dejaba entrar a los socios en 'Inactivo'.
       AND cs.cuenta_como_activo
       AND (p_categoria_id IS NULL OR s.categoria_id = p_categoria_id)
  )
  SELECT b.id, b.nro_socio, b.apellido, b.nombre, b.dni, b.categoria_id,
         b.categoria, b.fecha_alta, b.localidad, b.fecha_nacimiento, b.edad,
         b.antiguedad_anios, b.habilita_voto, b.cuotas_sociales_emitidas, v_corte
    FROM base b
   WHERE NOT p_solo_habilitados
      OR ( b.habilita_voto
       -- Sin fecha de nacimiento no se puede acreditar la edad: se excluye.
       AND b.fecha_nacimiento IS NOT NULL
       AND b.edad >= 18
       AND b.antiguedad_anios >= 1
       AND NOT EXISTS (
             SELECT 1 FROM cuotas c
               JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
              WHERE c.socio_id = b.id AND tc.afecta_padron AND NOT c.pagada
                AND c.periodo < v_corte   -- la del último período se tolera
           ))
   -- Orden total (nro_socio es UNIQUE): PostgREST pagina sobre este orden y
   -- sin desempate único fetchAllRows repetiría o saltearía filas.
   ORDER BY b.apellido, b.nombre, b.nro_socio;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_padron(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_padron(uuid, boolean) TO authenticated;
