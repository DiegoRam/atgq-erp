-- ============================================================
-- ATGQ ERP — SOCIOS Helper RPCs
-- Pre-req for Phase 3 (Módulo SOCIOS)
-- ============================================================

-- Category counts for FacetFilter
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(categoria_id UUID, nombre TEXT, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT s.categoria_id, cs.nombre, COUNT(*) AS count
  FROM socios s
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
  GROUP BY s.categoria_id, cs.nombre
  ORDER BY cs.nombre;
$$;

-- Socios morosos (with unpaid cuotas)
CREATE OR REPLACE FUNCTION get_socios_morosos(p_page INT DEFAULT 1, p_page_size INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  nro_socio INT,
  apellido TEXT,
  nombre TEXT,
  dni TEXT,
  categoria TEXT,
  cuotas_impagas BIGINT,
  monto_adeudado NUMERIC,
  ultima_cuota_pagada DATE
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id,
    s.nro_socio,
    s.apellido,
    s.nombre,
    s.dni,
    cs.nombre AS categoria,
    COUNT(c.id) AS cuotas_impagas,
    COALESCE(SUM(c.monto), 0) AS monto_adeudado,
    (SELECT MAX(c2.fecha_pago)::DATE FROM cuotas c2 WHERE c2.socio_id = s.id AND c2.pagada = true) AS ultima_cuota_pagada
  FROM socios s
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
  JOIN cuotas c ON c.socio_id = s.id AND c.pagada = false
  WHERE s.fecha_baja IS NULL
  GROUP BY s.id, s.nro_socio, s.apellido, s.nombre, s.dni, cs.nombre
  ORDER BY cuotas_impagas DESC, s.apellido
  LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
$$;

-- Count of morosos (for pagination)
CREATE OR REPLACE FUNCTION get_socios_morosos_count()
RETURNS BIGINT
LANGUAGE sql STABLE
AS $$
  SELECT COUNT(DISTINCT s.id)
  FROM socios s
  JOIN cuotas c ON c.socio_id = s.id AND c.pagada = false
  WHERE s.fecha_baja IS NULL;
$$;

-- Socios por categoría (report)
CREATE OR REPLACE FUNCTION get_socios_por_categoria()
RETURNS TABLE(categoria TEXT, cantidad BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT cs.nombre AS categoria, COUNT(*) AS cantidad
  FROM socios s
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
  WHERE s.fecha_baja IS NULL
  GROUP BY cs.nombre
  ORDER BY cantidad DESC;
$$;

-- Socios por edad (report)
CREATE OR REPLACE FUNCTION get_socios_por_edad()
RETURNS TABLE(rango TEXT, cantidad BIGINT)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT sub.rango, sub.cantidad FROM (
    SELECT
      CASE
        WHEN s.fecha_nacimiento IS NULL THEN 'Sin dato'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, s.fecha_nacimiento)) < 18 THEN '0-17'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, s.fecha_nacimiento)) <= 30 THEN '18-30'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, s.fecha_nacimiento)) <= 45 THEN '31-45'
        WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, s.fecha_nacimiento)) <= 60 THEN '46-60'
        ELSE '61+'
      END AS rango,
      COUNT(*) AS cantidad
    FROM socios s
    WHERE s.fecha_baja IS NULL
    GROUP BY 1
  ) sub
  ORDER BY
    CASE sub.rango
      WHEN '0-17' THEN 1
      WHEN '18-30' THEN 2
      WHEN '31-45' THEN 3
      WHEN '46-60' THEN 4
      WHEN '61+' THEN 5
      WHEN 'Sin dato' THEN 6
    END;
END;
$$;

-- Cuotas mensuales (report)
CREATE OR REPLACE FUNCTION get_cuotas_mensuales(fecha_desde DATE, fecha_hasta DATE)
RETURNS TABLE(mes TEXT, cuotas_pagadas BIGINT, monto NUMERIC)
LANGUAGE sql STABLE
AS $$
  SELECT
    TO_CHAR(c.fecha_pago, 'YYYY-MM') AS mes,
    COUNT(*) AS cuotas_pagadas,
    SUM(c.monto) AS monto
  FROM cuotas c
  WHERE c.pagada = true
    AND c.fecha_pago >= fecha_desde
    AND c.fecha_pago < fecha_hasta + INTERVAL '1 day'
  GROUP BY TO_CHAR(c.fecha_pago, 'YYYY-MM')
  ORDER BY mes;
$$;

-- Socios por localidad (report)
CREATE OR REPLACE FUNCTION get_socios_por_localidad()
RETURNS TABLE(localidad TEXT, cantidad BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(s.localidad), ''), 'Sin especificar') AS localidad,
    COUNT(*) AS cantidad
  FROM socios s
  WHERE s.fecha_baja IS NULL
  GROUP BY localidad
  ORDER BY cantidad DESC;
$$;
