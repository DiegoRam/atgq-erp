-- ============================================================================
-- ATGQ ERP — Parámetros del sistema
--
-- Réplica moderna de la tabla `Configuracion` del legacy
-- (docs/backup_schema.sql:39-68): una sola fila, columnas tipadas. Arranca
-- con un único parámetro — el `VentaDefault = 20` del legacy, que es el
-- recargo por defecto para no socios — y queda como punto de extensión para
-- el resto (SMTP, StockNegativo, datos de la entidad) sin volver a discutir
-- la forma.
--
-- Single-row y no key/value a propósito: un `valor text` saca la validación
-- de la base y obliga a parsear en cada lectura. Agregar un parámetro acá es
-- un ADD COLUMN con DEFAULT, una migración de una línea.
--
-- Hasta esta migración el 20% vivía hardcodeado en
-- src/components/ventas/ItemVentaForm.tsx y como literal en las migraciones
-- …000001 y …000002: no se podía cambiar sin desplegar, ni reaplicar al
-- catálogo existente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS configuracion (
  -- El CHECK + la PK hacen imposible una segunda fila: todo lector puede
  -- hacer `where id = 1` sin preguntarse cuál es la buena.
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Recargo para no socios, en porcentaje sobre la tarifa de socio.
  -- 0 es un valor válido y significa "el no socio paga lo mismo".
  -- El tope de 200 es un guard de fat-finger: un 2000 tipeado en vez de 20
  -- triplicaría todo el tarifario de un solo click.
  recargo_no_socio_pct NUMERIC(5,2) NOT NULL DEFAULT 20
    CHECK (recargo_no_socio_pct >= 0 AND recargo_no_socio_pct <= 200),

  -- Marca de la última reconstrucción masiva. No es un historial: es lo
  -- mínimo para que la pantalla conteste "¿ya la corrí?" antes de apretar un
  -- botón que pisa todos los precios.
  recargo_aplicado_at    TIMESTAMPTZ,
  recargo_aplicado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recargo_aplicado_items INTEGER,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE configuracion IS
  'Parámetros globales del sistema. Fila única (id = 1).';
COMMENT ON COLUMN configuracion.recargo_no_socio_pct IS
  'Recargo % sobre la tarifa de socio para calcular la de no socio. Reemplaza al VentaDefault del legacy.';

-- Reusa el trigger de `socios` (…000001:328). Ojo: también se dispara cuando
-- el RPC estampa recargo_aplicado_*, así que `updated_at` es "última
-- escritura", no "último cambio de parámetro".
DROP TRIGGER IF EXISTS trg_configuracion_updated_at ON configuracion;
CREATE TRIGGER trg_configuracion_updated_at
  BEFORE UPDATE ON configuracion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed. DO NOTHING para no pisar un pct que el club ya haya cambiado si esta
-- migración se re-aplica.
INSERT INTO configuracion (id, recargo_no_socio_pct)
VALUES (1, 20)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- permiso_modulo_todos_los_roles — variante determinista de
-- get_user_modulo_permission()
--
-- El helper original (…000009) resuelve con `LIMIT 1` sobre un join
-- `usuarios_roles ⋈ permisos_modulo` **sin ORDER BY**: con un usuario que
-- tenga más de un rol elige una fila arbitraria en vez de fusionar. Un
-- Administrador que además tenga "Solo Lectura" puede, según el plan que
-- elija el planner, resolver como Solo Lectura y quedar sin permiso. La capa
-- de aplicación (`src/lib/permissions.ts`) hace lo contrario: fusiona
-- most-permissive entre roles, así que las dos capas se contradicen.
--
-- `bool_or` sobre todos los roles del usuario es la misma semántica que la
-- app y no depende del plan de ejecución. Se usa **sólo en los objetos nuevos
-- de esta migración**: cambiar el helper original tocaría las políticas RLS de
-- las 25 tablas, que es una corrección de otro alcance.
-- ============================================================================
CREATE OR REPLACE FUNCTION permiso_modulo_todos_los_roles(p_modulo text, p_permiso text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(bool_or(
    CASE p_permiso
      WHEN 'leer'     THEN pm.puede_leer
      WHEN 'escribir' THEN pm.puede_escribir
      WHEN 'eliminar' THEN pm.puede_eliminar
    END
  ), false)
  FROM usuarios_roles ur
  JOIN permisos_modulo pm ON pm.rol_id = ur.rol_id
  WHERE ur.user_id = auth.uid() AND pm.modulo = p_modulo;
$$;

GRANT EXECUTE ON FUNCTION permiso_modulo_todos_los_roles(text, text) TO authenticated;

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Lectura cruzada de módulo: el ABM de ítems de venta necesita el pct para
-- autocompletar y la fila no guarda secretos. Precedente: select_depositos
-- (20260803000003:13-27).
DROP POLICY IF EXISTS "select_configuracion" ON configuracion;
CREATE POLICY "select_configuracion" ON configuracion FOR SELECT TO authenticated
  USING (
    permiso_modulo_todos_los_roles('seguridad', 'leer')
    OR permiso_modulo_todos_los_roles('ventas', 'leer')
  );

DROP POLICY IF EXISTS "update_configuracion" ON configuracion;
CREATE POLICY "update_configuracion" ON configuracion FOR UPDATE TO authenticated
  USING (permiso_modulo_todos_los_roles('seguridad', 'escribir'))
  WITH CHECK (permiso_modulo_todos_los_roles('seguridad', 'escribir'));

-- SIN políticas de INSERT ni DELETE, a propósito: con RLS activa la ausencia
-- de política deniega. La fila la creó esta migración (owner, bypass de RLS)
-- y ningún usuario autenticado puede borrarla ni duplicarla.


-- ============================================================================
-- precios_no_socio_pendientes — la regla, definida UNA vez
--
-- Las filas que el recálculo cambiaría. La consumen el conteo, la muestra del
-- preview y el UPDATE: es lo que garantiza que el preview no pueda prometer
-- una cosa y la ejecución hacer otra.
--
-- `IS DISTINCT FROM` no es una excepción de alcance — el alcance es TODO el
-- catálogo, activo o no, con tarifa propia o no. Es una excepción de
-- *escritura*: evita UPDATEs que no cambian nada y hace la corrida idempotente
-- (la segunda vez reporta 0 afectados).
--
-- SECURITY INVOKER (el default): corre dentro del DEFINER de abajo, y se le
-- revoca EXECUTE para que no quede expuesta como endpoint de PostgREST.
-- ============================================================================
CREATE OR REPLACE FUNCTION precios_no_socio_pendientes(p_pct NUMERIC)
RETURNS TABLE (
  item_id UUID,
  nombre  TEXT,
  precio  NUMERIC,
  actual  NUMERIC,
  nuevo   NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT iv.id,
         iv.nombre,
         iv.precio,
         iv.precio_no_socio,
         round(iv.precio * (1 + p_pct / 100), 2)
    FROM items_ventas iv
   WHERE iv.precio_no_socio IS DISTINCT FROM round(iv.precio * (1 + p_pct / 100), 2);
$$;

-- Revocar de PUBLIC no alcanza: Supabase concede `ALL ON FUNCTIONS` a anon y
-- authenticated por default privileges del schema public, así que el grant de
-- cada rol sobrevive al REVOKE de PUBLIC y la función quedaría publicada como
-- RPC. Hay que nombrarlos.
REVOKE EXECUTE ON FUNCTION precios_no_socio_pendientes(NUMERIC)
  FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- recalcular_precios_no_socio — SECURITY DEFINER
--
-- Preview y ejecución en una sola función: `p_dry_run` es lo único que cambia.
-- El porcentaje NO es parámetro — sale de `configuracion` acá adentro, así que
-- el browser no puede mandar el suyo ni el preview puede calcular con un
-- número y la ejecución escribir con otro.
--
-- SECURITY DEFINER porque escribe `items_ventas` (módulo ventas) desde una
-- pantalla del módulo seguridad. RLS no aplica, así que el chequeo es
-- obligatorio acá, y pide LOS DOS permisos: quien corre esto ya tiene que
-- poder editar el parámetro Y el tarifario. En la práctica, sólo Administrador.
--
-- ALCANCE: todas las filas, sin excepción. Pisa las ~20 tarifas propias del
-- legacy y los ítems inactivos: la configuración manda.
--
-- DOS CONSECUENCIAS QUE EL PREVIEW TIENE QUE MOSTRAR, no esconder:
--   * `a_cero` — los ítems con `precio = 0` ("no se le vende a socios")
--     quedan en $0 también para no socios y pierden su tarifa real.
--   * `con_nombre_socio` — el club modeló parte de la distinción como ítems
--     separados (`Permiso de Caza - No Socio` / `- Socio`). A esos el recargo
--     se les aplica dos veces: una en el nombre y otra en la columna.
--     El match es a propósito **inclusivo** y sobre-cuenta: `LLAVE SALA DE
--     SOCIOS` cae acá sin ser un par. Acotarlo a `no[ -]?socio` sería peor —
--     perdería la mitad "socio" de cada par (`FICHAS Helices Socios -
--     Escopeta`), que es justo la que no debería llevar recargo. Por eso el
--     contador se presenta como "revise estos" y no como una afirmación.
-- ============================================================================
-- La firma cambia (gana p_pct_esperado), así que hay que soltar la anterior:
-- un CREATE OR REPLACE dejaría las dos y PostgREST no sabría cuál llamar.
DROP FUNCTION IF EXISTS recalcular_precios_no_socio(BOOLEAN);

CREATE OR REPLACE FUNCTION recalcular_precios_no_socio(
  p_dry_run BOOLEAN DEFAULT true,
  -- Porcentaje que el operador vio en la previsualización. En la ejecución
  -- real el cliente lo manda de vuelta y la función aborta si alguien cambió
  -- la configuración en el medio: preview y escritura son dos llamadas
  -- distintas, y sin esto el "Confirmar" aplicaría números que nadie revisó.
  -- No es el pct que se usa —ése sale siempre de la tabla—, es sólo el testigo.
  p_pct_esperado NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  pct              NUMERIC,
  total            INTEGER,
  afectados        INTEGER,
  a_cero           INTEGER,
  con_nombre_socio INTEGER,
  muestra          JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pct     NUMERIC(5,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (permiso_modulo_todos_los_roles('seguridad', 'escribir')
          AND permiso_modulo_todos_los_roles('ventas', 'escribir')) THEN
    RAISE EXCEPTION 'No tiene permisos para recalcular los precios de no socio';
  END IF;

  SELECT c.recargo_no_socio_pct INTO v_pct FROM configuracion c WHERE c.id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay configuración del sistema cargada';
  END IF;

  IF p_pct_esperado IS NOT NULL AND p_pct_esperado <> v_pct THEN
    RAISE EXCEPTION 'El recargo cambió a % desde que se generó la previsualización (era %). Vuelva a previsualizar.',
      v_pct, p_pct_esperado;
  END IF;

  SELECT count(*)::INTEGER INTO total FROM items_ventas;

  SELECT count(*)::INTEGER,
         count(*) FILTER (WHERE p.nuevo = 0)::INTEGER,
         count(*) FILTER (WHERE p.nombre ~* 'socio')::INTEGER
    INTO afectados, a_cero, con_nombre_socio
    FROM precios_no_socio_pendientes(v_pct) p;

  -- 50 filas ordenadas por magnitud del cambio: lo más consecuente arriba.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'nombre', m.nombre,
           'precio', m.precio,
           'actual', m.actual,
           'nuevo',  m.nuevo)), '[]'::jsonb)
    INTO muestra
    FROM (
      SELECT p.nombre, p.precio, p.actual, p.nuevo
        FROM precios_no_socio_pendientes(v_pct) p
       ORDER BY abs(p.nuevo - p.actual) DESC, p.nombre
       LIMIT 50
    ) m;

  IF NOT p_dry_run THEN
    -- precios_no_socio_pendientes es STABLE: el set se evalúa una vez al
    -- inicio del statement, así que el UPDATE no lee sus propias escrituras.
    UPDATE items_ventas iv
       SET precio_no_socio = p.nuevo
      FROM precios_no_socio_pendientes(v_pct) p
     WHERE iv.id = p.item_id;

    UPDATE configuracion
       SET recargo_aplicado_at    = now(),
           recargo_aplicado_por   = v_user_id,
           recargo_aplicado_items = afectados
     WHERE id = 1;
  END IF;

  pct := v_pct;
  RETURN NEXT;
END;
$$;

-- Mismo ACL que registrar_venta: sólo `authenticated`. Sin el REVOKE previo,
-- `anon` conservaría el EXECUTE de los default privileges y podría golpear el
-- endpoint (rebotaría en el chequeo de auth.uid(), pero no hay razón para
-- publicarlo).
REVOKE EXECUTE ON FUNCTION recalcular_precios_no_socio(BOOLEAN, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION recalcular_precios_no_socio(BOOLEAN, NUMERIC) TO authenticated;
