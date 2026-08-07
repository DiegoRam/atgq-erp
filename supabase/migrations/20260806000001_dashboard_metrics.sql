-- ============================================================
-- ATGQ ERP — Métricas del Dashboard
--
-- Arregla tres defectos de src/app/(dashboard)/actions.ts:
--
--  1. Truncamiento silencioso: recaudación, ventas y el gráfico de 6 meses
--     traían filas con .select() sin .range() y sumaban en JS. PostgREST
--     corta en max_rows (1000), así que cualquier ventana con más de 1000
--     movimientos quedaba subestimada sin aviso. Ahora se agrega en SQL.
--
--  2. Ventana de mes dependiente del TZ del servidor: new Date(y, m, 1) usa
--     el huso del proceso (UTC en Vercel), corriendo el mes 3 h respecto de
--     Argentina. Acá los límites se calculan en America/Argentina/Buenos_Aires.
--
--  3. "Socios Activos" contaba sólo fecha_baja IS NULL. En los datos migrados
--     del legacy el estado real vive en la categoría social (hay una categoría
--     literal 'BAJA'), así que el KPI incluía bajas. Se agrega la bandera
--     categorias_sociales.cuenta_como_activo para que la regla sea dato
--     editable y no un nombre hardcodeado en las queries.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Qué categorías cuentan como socio activo
-- ------------------------------------------------------------
ALTER TABLE categorias_sociales
  ADD COLUMN IF NOT EXISTS cuenta_como_activo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN categorias_sociales.cuenta_como_activo IS
  'Si los socios de esta categoría cuentan como activos en el KPI del dashboard '
  'y en el filtro Estado del padrón. Las categorías de baja/inactividad van en false.';

-- Seed inicial por nombre (una sola vez, no es un lookup en runtime).
-- Las variantes "-Ventanilla" cuentan como socios (decisión de negocio, 2026-08-06).
UPDATE categorias_sociales
SET cuenta_como_activo = false
WHERE upper(btrim(nombre)) IN ('BAJA', 'INACTIVO');

-- ------------------------------------------------------------
-- 2. Métricas del dashboard, agregadas en SQL
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS TABLE (
  socios_activos      BIGINT,
  socios_total        BIGINT,
  socios_morosos      BIGINT,
  resultado_neto_mes  NUMERIC,
  ventas_mes          NUMERIC,
  items_sin_stock     BIGINT,
  serie_6_meses       JSONB
)
LANGUAGE sql
STABLE
AS $$
  WITH r AS (
    SELECT
      m0                                                                              AS mes_inicio,
      (m0::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')                   AS mes_desde,
      ((m0 + INTERVAL '1 month')::timestamp
         AT TIME ZONE 'America/Argentina/Buenos_Aires')                               AS mes_hasta,
      (((m0 - INTERVAL '5 months')::date)::timestamp
         AT TIME ZONE 'America/Argentina/Buenos_Aires')                               AS serie_desde
    FROM (
      SELECT date_trunc(
               'month',
               (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
             )::date AS m0
    ) p
  ),

  -- Los 6 meses siempre presentes, aunque no tengan movimientos
  meses AS (
    SELECT generate_series(
             (SELECT mes_inicio - INTERVAL '5 months' FROM r),
             (SELECT mes_inicio::timestamp FROM r),
             INTERVAL '1 month'
           )::date AS mes
  ),

  mov_serie AS (
    SELECT
      date_trunc('month', m.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS mes,
      COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'ingreso'), 0)
        - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'egreso'), 0)                   AS total
    FROM movimientos_fondos m
    CROSS JOIN r
    WHERE m.fecha >= r.serie_desde
      AND m.fecha <  r.mes_hasta
    GROUP BY 1
  ),

  serie AS (
    SELECT COALESCE(
             jsonb_agg(
               jsonb_build_object(
                 'mes',   to_char(ms.mes, 'YYYY-MM'),
                 'total', COALESCE(mv.total, 0)
               ) ORDER BY ms.mes
             ),
             '[]'::jsonb
           ) AS j
    FROM meses ms
    LEFT JOIN mov_serie mv ON mv.mes = ms.mes
  )

  SELECT
    -- Socios activos: sin fecha de baja Y en una categoría que cuenta como activa
    (SELECT COUNT(*)
       FROM socios s
       JOIN categorias_sociales c ON c.id = s.categoria_id
      WHERE s.fecha_baja IS NULL
        AND c.cuenta_como_activo)::BIGINT,

    (SELECT COUNT(*) FROM socios)::BIGINT,

    -- Mismo predicado que get_socios_morosos_count(), para que la tarjeta
    -- coincida con la pantalla /socios/morosos a la que enlaza.
    (SELECT COUNT(DISTINCT s.id)
       FROM socios s
       JOIN cuotas cu ON cu.socio_id = s.id AND cu.pagada = false
      WHERE s.fecha_baja IS NULL)::BIGINT,

    (SELECT COALESCE(SUM(mf.monto) FILTER (WHERE mf.tipo = 'ingreso'), 0)
            - COALESCE(SUM(mf.monto) FILTER (WHERE mf.tipo = 'egreso'), 0)
       FROM movimientos_fondos mf
       CROSS JOIN r
      WHERE mf.fecha >= r.mes_desde
        AND mf.fecha <  r.mes_hasta),

    (SELECT COALESCE(SUM(v.total), 0)
       FROM ventas v
       CROSS JOIN r
      WHERE v.anulada = false
        AND v.fecha >= r.mes_desde
        AND v.fecha <  r.mes_hasta),

    (SELECT COUNT(*) FROM stock_inventario WHERE cantidad <= 0)::BIGINT,

    (SELECT j FROM serie);
$$;

COMMENT ON FUNCTION get_dashboard_metrics() IS
  'KPIs del dashboard agregados en SQL. Reemplaza las sumas en JS que PostgREST '
  'truncaba a max_rows (1000 filas). Ventanas de mes en America/Argentina/Buenos_Aires.';

-- ------------------------------------------------------------
-- 3. Conteo de socios por estado, para el filtro del padrón
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_estado_counts()
RETURNS TABLE (estado TEXT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT 'activos'::TEXT,
         COUNT(*)::BIGINT
    FROM socios s
    JOIN categorias_sociales c ON c.id = s.categoria_id
   WHERE s.fecha_baja IS NULL AND c.cuenta_como_activo
  UNION ALL
  SELECT 'bajas'::TEXT,
         COUNT(*)::BIGINT
    FROM socios s
    JOIN categorias_sociales c ON c.id = s.categoria_id
   WHERE s.fecha_baja IS NOT NULL OR NOT c.cuenta_como_activo;
$$;
