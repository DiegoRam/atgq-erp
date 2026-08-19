-- =============================================================================
-- restore_datos_erp.sql — Reinserta lo que el ERP creó y el TRUNCATE se llevó
--
-- CUÁNDO SE CORRE: DESPUÉS de migrate.py, en una sesión de psql aparte.
--   1) migration/clean_demo_seed.sql   -> snapshot en `respaldo_premigracion` + TRUNCATE
--   2) migrate.py                      -> repuebla el legacy (uuid v5 determinista)
--   3) ESTE ARCHIVO                    -> devuelve lo nacido en el ERP (uuid v4)
--                                         + los vínculos de la app móvil
--
--   PGPASSWORD=... /usr/local/opt/libpq/bin/psql "$CONN" -v ON_ERROR_STOP=1 \
--       -f migration/restore_datos_erp.sql
--
-- POR QUÉ FUNCIONA: migrate.py genera ids deterministas (uuid5 del NroSocio,
-- migrate.py:29/:36), así que el socio 4211 vuelve con EL MISMO id que tenía.
-- Una cuota o un vínculo de app móvil respaldados apuntan a un id que va a
-- volver a existir. Todo el archivo depende de eso; si migrate.py cambiara el
-- namespace o la clave, esto deja de tener sentido y hay que revisarlo.
--
-- QUÉ HACE, PARA CADA TABLA DEL MANIFIESTO Y EN ORDEN DE FK:
--   a) marca como RECHAZADAS las filas que no se pueden insertar, con motivo:
--        - fk_huerfana     : apunta a algo que ya no existe (típico: un socio
--                            que desapareció del dump nuevo)
--        - colision_unique : hay OTRA fila con distinto id que ya ocupa esa
--                            clave única (típico: un socio dado de alta en el
--                            ERP con un nro_socio que ahora también trae el
--                            legacy). Ojo: ON CONFLICT (id) DO NOTHING NO cubre
--                            esto — es una violación de UNIQUE, no de PK, y sin
--                            este chequeo el script moriría con un error críptico.
--   b) inserta el resto con ON CONFLICT (id) DO NOTHING (idempotente).
--
-- Los chequeos NO son un WHERE que filtra en silencio: cada fila descartada
-- queda en `respaldo_premigracion.rechazos` con su motivo y su detalle, y sale
-- en el reporte final. Nada se pierde sin que alguien lo vea.
--
-- CORRERLO DOS VECES ES SEGURO: la segunda pasada inserta 0 filas y reporta lo
-- mismo. Los rechazos se recalculan de cero en cada corrida.
--
-- EL RESPALDO NO SE BORRA ACÁ. A propósito: es la red de seguridad y el drop es
-- un paso manual, cuando la migración ya esté dada por buena:
--     DROP SCHEMA respaldo_premigracion CASCADE;
--
-- HUÉRFANOS DE socios_usuarios = FRENO DE MANO
-- --------------------------------------------
-- Si un vínculo de app móvil apunta a un socio que ya no existe en el dump
-- nuevo, este script ABORTA TODO (rollback) en vez de saltear la fila. Es
-- identidad de usuario: hay una persona con una cuenta que quedaría colgada, o
-- peor, un socio dado de baja en el legacy que sigue entrando a la app. Eso lo
-- tiene que mirar alguien, no resolverlo un WHERE. Si después de mirarlo se
-- decide seguir igual (p. ej. son bajas reales y se les revoca el acceso):
--
--     PGOPTIONS='-c migracion.permitir_huerfanos_socios_usuarios=on' psql ... -f este_archivo
--
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 0. El respaldo tiene que existir. Si no, alguien se salteó el paso 1 (o lo
--    borró); seguir sería no hacer nada y creer que salió bien.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'respaldo_premigracion') THEN
    RAISE EXCEPTION 'No existe el schema respaldo_premigracion: no hay nada que restaurar.'
      USING HINT = 'Lo crea migration/clean_demo_seed.sql. Si ya se borró a mano, los datos del ERP no se pueden recuperar desde acá.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM respaldo_premigracion.manifiesto WHERE en_plan) THEN
    RAISE EXCEPTION 'El manifiesto del respaldo está vacío.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS respaldo_premigracion.rechazos (
  tabla   text NOT NULL,
  id      uuid NOT NULL,
  motivo  text NOT NULL,
  -- Nombre de la FK o del índice único que la rechaza. Está en la PK porque una
  -- misma fila puede fallar por DOS causas a la vez (el caso real: un socio del
  -- ERP cuyo nro_socio Y cuyo dni ya los trae el legacy). Sin esta columna la
  -- segunda causa se perdía por el ON CONFLICT y el reporte contaba media verdad.
  origen  text NOT NULL,
  detalle text,
  PRIMARY KEY (tabla, id, motivo, origen)
);
COMMENT ON TABLE respaldo_premigracion.rechazos IS
  'Filas respaldadas que NO se pudieron reinsertar, con el motivo. Se recalcula entera en cada corrida del restore.';

CREATE TABLE IF NOT EXISTS respaldo_premigracion.restore_log (
  tabla            text PRIMARY KEY,
  orden            int,
  respaldadas      bigint,
  ya_estaban       bigint,   -- presentes en destino antes de esta corrida (2da pasada, o repuestas por migrate.py)
  insertadas       bigint,   -- insertadas por ESTA corrida
  rechazadas       bigint,
  presentes_final  bigint,
  descartada       boolean NOT NULL DEFAULT false,  -- tabla transaccional: no se repone (ver POLÍTICA más abajo)
  corrida_at       timestamptz
);
-- La tabla puede venir de una corrida anterior sin esta columna.
ALTER TABLE respaldo_premigracion.restore_log
  ADD COLUMN IF NOT EXISTS descartada boolean NOT NULL DEFAULT false;
COMMENT ON TABLE respaldo_premigracion.restore_log IS
  'Resultado de la última corrida de restore_datos_erp.sql, por tabla.';

DELETE FROM respaldo_premigracion.rechazos;
DELETE FROM respaldo_premigracion.restore_log;

-- -----------------------------------------------------------------------------
-- Triggers que hay que apagar mientras se restaura (y sólo mientras).
--
-- * ventas.trg_ventas_comprador_guard: valida en INSERT que la credencial de
--   legítimo usuario del no-socio no esté VENCIDA **al día de hoy**. Una venta
--   real de julio con credencial vencida en agosto es un dato histórico
--   perfectamente válido: si el trigger corre, el restore muere y perdemos la
--   venta por una regla pensada para el mostrador, no para un replay.
-- * socios.trg_socios_updated_at: la segunda fase de socios (completar
--   grupo_familiar_id) es un UPDATE técnico; sin apagarlo, los ~socios del ERP
--   quedarían todos con updated_at = hoy y se perdería cuándo se editaron.
--
-- NO se apaga socios_usuarios.trg_socios_usuarios_excluye_staff: es la
-- invariante de seguridad de la app móvil (una cuenta no puede ser socio Y
-- staff a la vez). Si llegara a saltar, es que el estado cambió entre el clean
-- y el restore y hay que mirarlo — que reviente es el comportamiento correcto.
--
-- Si algo falla más abajo, la transacción vuelve atrás y estos ALTER también.
-- -----------------------------------------------------------------------------
ALTER TABLE public.ventas DISABLE TRIGGER trg_ventas_comprador_guard;
ALTER TABLE public.socios DISABLE TRIGGER trg_socios_updated_at;

-- -----------------------------------------------------------------------------
-- 1. Motor de restauración.
--
--    Las condiciones de rechazo se derivan del CATÁLOGO (pg_constraint /
--    pg_index) y no de una lista escrita a mano: si mañana se agrega una FK o
--    un UNIQUE, el chequeo lo cubre solo. Constraints únicas que hoy existen y
--    que este motor cubre (verificadas contra la base, no de memoria):
--      socios(nro_socio), socios(dni), cajas(nombre), depositos(nombre),
--      instalaciones(nombre), metodos_cobranza(nombre), tipos_cuotas(nombre),
--      categorias_sociales(nombre), categorias_movimientos(nombre,tipo),
--      stock_inventario(item_id,deposito_id), socios_actividades(socio_id,actividad_id),
--      socios_invitaciones(codigo_hash), socios_invitaciones(socio_id) WHERE viva,
--      socios_usuarios(socio_id) WHERE activo, socios_usuarios(user_id) WHERE activo.
--    Los índices únicos PARCIALES (los WHERE de arriba) se evalúan con su
--    predicado en los dos lados: una fila revocada no colisiona con nada.
-- -----------------------------------------------------------------------------
DO $restore$
DECLARE
  r_tab      record;
  r_fk       record;
  r_uq       record;
  v_dif      text[];      -- columnas diferidas por ciclo de FK (se insertan en NULL)
  v_cols     text;
  v_vals     text;
  v_notnull  text;
  v_join     text;
  v_eq       text;
  v_det      text;
  v_pred     text;
  v_pre      bigint;
  v_ins      bigint;
  v_rech     bigint;
  v_fin      bigint;
BEGIN
  -- ---------------------------------------------------------------------------
  -- POLÍTICA: las tablas TRANSACCIONALES no se reponen.
  --
  -- Mientras el club siga operando en el sistema legacy, el ERP no recibe carga
  -- real: toda venta, movimiento o cuota que aparezca acá es una PRUEBA. Y como
  -- se re-migra varias veces, reponerlas significaría acumular basura de testing
  -- en producción, corrida tras corrida, sin que nadie sepa después cuál era
  -- prueba y cuál no. Decisión del dueño del sistema (2026-08-18): en cada
  -- re-migración se arranca de cero.
  --
  -- Ojo con la lectura: NO reponer no es destruir. El snapshot de
  -- clean_demo_seed.sql igual las copió a respaldo_premigracion, y ahí se quedan
  -- hasta que alguien haga el DROP SCHEMA. Si resulta que una hacía falta, está.
  --
  -- Los CATÁLOGOS sí se reponen: una categoría de tesorería, un depósito o un
  -- ítem creado desde el ERP es configuración que la app necesita, no una
  -- prueba, y perderlo rompe pantallas.
  --
  -- Cuando se abandone el legacy y el ERP pase a ser la fuente de verdad, esta
  -- lista tiene que quedar VACÍA — y probablemente este archivo entero deje de
  -- tener sentido, porque ya no habría que truncar nada.
  -- ---------------------------------------------------------------------------
  FOR r_tab IN
    SELECT tabla, orden_restore, filas_respaldadas,
           tabla IN ('ventas', 'ventas_items', 'movimientos_fondos',
                     'movimientos_stock', 'stock_inventario', 'cuotas',
                     'turnos', 'socios_actividades') AS es_prueba
      FROM respaldo_premigracion.manifiesto
     WHERE en_plan
     ORDER BY orden_restore
  LOOP
    IF r_tab.es_prueba THEN
      IF r_tab.filas_respaldadas > 0 THEN
        RAISE NOTICE '  % — % fila(s) de prueba DESCARTADAS (siguen en respaldo_premigracion.%)',
          rpad(r_tab.tabla, 24), r_tab.filas_respaldadas, r_tab.tabla;
      END IF;
      INSERT INTO respaldo_premigracion.restore_log
        (tabla, orden, respaldadas, insertadas, ya_estaban, rechazadas, presentes_final, descartada)
      VALUES (r_tab.tabla, r_tab.orden_restore, r_tab.filas_respaldadas, 0, 0, 0, 0, true);
      CONTINUE;
    END IF;
    -- El ciclo socios <-> grupos_familiares no se puede insertar de una: las FKs
    -- no son DEFERRABLE, así que socios entra con grupo_familiar_id en NULL y se
    -- completa en el paso 2, cuando grupos_familiares ya está.
    v_dif := CASE WHEN r_tab.tabla = 'socios'
                  THEN ARRAY['grupo_familiar_id'] ELSE ARRAY[]::text[] END;

    EXECUTE format('SELECT count(*) FROM public.%I p WHERE EXISTS (SELECT 1 FROM respaldo_premigracion.%I b WHERE b.id = p.id)',
                   r_tab.tabla, r_tab.tabla) INTO v_pre;

    -- ---------------------------------------------------------------------
    -- 1a. Rechazos por FK huérfana.
    --     Semántica MATCH SIMPLE: si alguna columna de la FK es NULL, Postgres
    --     no chequea nada -> tampoco chequeamos nosotros.
    -- ---------------------------------------------------------------------
    FOR r_fk IN
      SELECT c.conname,
             c.confrelid::regclass::text AS reftabla,
             (SELECT array_agg(quote_ident(a.attname) ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY AS k(att, ord)
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.att) AS cols,
             (SELECT array_agg(quote_ident(a.attname) ORDER BY k.ord)
                FROM unnest(c.confkey) WITH ORDINALITY AS k(att, ord)
                JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.att) AS refcols,
             -- Mismos nombres que `cols` pero SIN quote_ident: `cols` se
             -- interpola en SQL (necesita las comillas) y `cols_planas` se
             -- compara contra v_dif (necesita el nombre crudo).
             (SELECT array_agg(a.attname::text ORDER BY k.ord)
                FROM unnest(c.conkey) WITH ORDINALITY AS k(att, ord)
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.att) AS cols_planas
        FROM pg_constraint c
       WHERE c.conrelid = format('public.%I', r_tab.tabla)::regclass
         AND c.contype = 'f'
       ORDER BY c.conname
    LOOP
      CONTINUE WHEN r_fk.cols_planas <@ v_dif;   -- se inserta NULL: no hay nada que chequear

      SELECT string_agg(format('b.%s IS NOT NULL', c), ' AND ')
        INTO v_notnull FROM unnest(r_fk.cols) AS c;
      SELECT string_agg(format('x.%s = b.%s', r_fk.refcols[i], r_fk.cols[i]), ' AND ')
        INTO v_join FROM generate_subscripts(r_fk.cols, 1) AS i;
      SELECT format('%L', r_fk.conname || ' -> ' || r_fk.reftabla || ': ')
             || ' || ' ||
             string_agg(format('%L || coalesce(b.%s::text, ''NULL'')', c || '=', c), ' || '', '' || ')
        INTO v_det FROM unnest(r_fk.cols) AS c;

      EXECUTE format($f$
        INSERT INTO respaldo_premigracion.rechazos (tabla, id, motivo, origen, detalle)
        SELECT %L, b.id, 'fk_huerfana', %L, %s
          FROM respaldo_premigracion.%I b
         WHERE %s
           AND NOT EXISTS (SELECT 1 FROM %s x WHERE %s)
           AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = b.id)
        ON CONFLICT DO NOTHING
      $f$, r_tab.tabla, r_fk.conname, v_det, r_tab.tabla, v_notnull,
           r_fk.reftabla, v_join, r_tab.tabla);
    END LOOP;

    -- ---------------------------------------------------------------------
    -- 1b. Rechazos por colisión de UNIQUE (lo que ON CONFLICT (id) NO ataja).
    --     "otra fila, distinto id, misma clave". Si el id es el mismo, es la
    --     propia fila ya restaurada -> no es colisión, es idempotencia.
    -- ---------------------------------------------------------------------
    FOR r_uq IN
      SELECT ic.relname AS idx,
             (SELECT array_agg(pg_get_indexdef(i.indexrelid, k, true) ORDER BY k)
                FROM generate_series(1, i.indnkeyatts) AS k) AS cols,
             pg_get_expr(i.indpred, i.indrelid) AS pred,
             i.indexprs IS NOT NULL AS por_expresion
        FROM pg_index i
        JOIN pg_class ic ON ic.oid = i.indexrelid
       WHERE i.indrelid = format('public.%I', r_tab.tabla)::regclass
         AND i.indisunique AND NOT i.indisprimary
       ORDER BY ic.relname
    LOOP
      IF r_uq.por_expresion THEN
        RAISE EXCEPTION 'Índice único por expresión no soportado por este restore: %.%',
          r_tab.tabla, r_uq.idx
          USING HINT = 'Agregá el caso a mano en restore_datos_erp.sql antes de correrlo.';
      END IF;

      -- En un índice único un NULL no colisiona con nada.
      SELECT string_agg(format('b.%s IS NOT NULL', c), ' AND ')
        INTO v_notnull FROM unnest(r_uq.cols) AS c;
      SELECT string_agg(format('x.%s = b.%s', c, c), ' AND ')
        INTO v_eq FROM unnest(r_uq.cols) AS c;
      SELECT string_agg(format('%L || coalesce(b.%s::text, ''NULL'')', c || '=', c), ' || '', '' || ')
        INTO v_det FROM unnest(r_uq.cols) AS c;
      -- El predicado del índice parcial viene con nombres sin calificar: en el
      -- SELECT externo resuelven contra b, y dentro del EXISTS contra x. Cada
      -- scope tiene una sola tabla, así que no hay ambigüedad posible.
      v_pred := coalesce(' AND (' || r_uq.pred || ')', '');

      EXECUTE format($f$
        INSERT INTO respaldo_premigracion.rechazos (tabla, id, motivo, origen, detalle)
        SELECT %L, b.id, 'colision_unique', %L,
               %L || (%s) || ' ya ocupado por id=' ||
               coalesce((SELECT x.id::text FROM public.%I x
                          WHERE x.id <> b.id AND %s %s LIMIT 1), '?')
          FROM respaldo_premigracion.%I b
         WHERE %s %s
           AND EXISTS (SELECT 1 FROM public.%I x WHERE x.id <> b.id AND %s %s)
           AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = b.id)
        ON CONFLICT DO NOTHING
      $f$, r_tab.tabla, r_uq.idx, r_uq.idx || ': ', v_det,
           r_tab.tabla, v_eq, v_pred,
           r_tab.tabla, v_notnull, v_pred,
           r_tab.tabla, v_eq, v_pred,
           r_tab.tabla);
    END LOOP;

    -- ---------------------------------------------------------------------
    -- 1c. Reinserción de todo lo que no quedó rechazado.
    --     Las columnas salen de la tabla de respaldo: si el esquema cambió y
    --     falta una columna en destino, esto revienta acá y no a la mitad.
    -- ---------------------------------------------------------------------
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
           string_agg(CASE WHEN column_name = ANY(v_dif)
                           THEN 'NULL' ELSE 'b.' || quote_ident(column_name) END,
                      ', ' ORDER BY ordinal_position)
      INTO v_cols, v_vals
      FROM information_schema.columns
     WHERE table_schema = 'respaldo_premigracion' AND table_name = r_tab.tabla;

    EXECUTE format($f$
      INSERT INTO public.%I (%s)
      SELECT %s FROM respaldo_premigracion.%I b
       WHERE NOT EXISTS (SELECT 1 FROM respaldo_premigracion.rechazos r
                          WHERE r.tabla = %L AND r.id = b.id)
      ON CONFLICT (id) DO NOTHING
    $f$, r_tab.tabla, v_cols, v_vals, r_tab.tabla, r_tab.tabla);
    GET DIAGNOSTICS v_ins = ROW_COUNT;

    -- DISTINCT: una misma fila puede ser rechazada por dos motivos (p.ej. choca
    -- por nro_socio Y por dni). Sin el DISTINCT el cuadre del reporte mentiría.
    SELECT count(DISTINCT id) INTO v_rech FROM respaldo_premigracion.rechazos WHERE tabla = r_tab.tabla;
    EXECUTE format('SELECT count(*) FROM public.%I p WHERE EXISTS (SELECT 1 FROM respaldo_premigracion.%I b WHERE b.id = p.id)',
                   r_tab.tabla, r_tab.tabla) INTO v_fin;

    INSERT INTO respaldo_premigracion.restore_log
      (tabla, orden, respaldadas, ya_estaban, insertadas, rechazadas, presentes_final, corrida_at)
    VALUES (r_tab.tabla, r_tab.orden_restore, r_tab.filas_respaldadas,
            v_pre, v_ins, v_rech, v_fin, now());

    RAISE NOTICE '% : respaldadas=% insertadas=% rechazadas=% presentes=%',
      rpad(r_tab.tabla, 22), r_tab.filas_respaldadas, v_ins, v_rech, v_fin;
  END LOOP;
END
$restore$;

-- -----------------------------------------------------------------------------
-- 2. Segunda fase del ciclo socios <-> grupos_familiares.
--    Ahora que grupos_familiares está restaurado, se completa el vínculo que el
--    paso 1c dejó en NULL. El IS DISTINCT FROM lo hace idempotente.
-- -----------------------------------------------------------------------------
UPDATE public.socios s
   SET grupo_familiar_id = b.grupo_familiar_id
  FROM respaldo_premigracion.socios b
 WHERE s.id = b.id
   AND b.grupo_familiar_id IS NOT NULL
   AND s.grupo_familiar_id IS DISTINCT FROM b.grupo_familiar_id
   AND EXISTS (SELECT 1 FROM public.grupos_familiares g WHERE g.id = b.grupo_familiar_id);

-- El socio se restauró, pero su grupo familiar no existe más: el socio queda
-- suelto. No es fatal (el dato del socio está), pero tiene que verse.
INSERT INTO respaldo_premigracion.rechazos (tabla, id, motivo, origen, detalle)
SELECT 'socios', b.id, 'fk_huerfana_parcial', 'socios_grupo_familiar_id_fkey',
       'grupo_familiar_id=' || b.grupo_familiar_id::text ||
       ' no existe: el socio se restauró SIN grupo familiar (nro_socio=' || b.nro_socio || ')'
  FROM respaldo_premigracion.socios b
  JOIN public.socios s ON s.id = b.id
 WHERE b.grupo_familiar_id IS NOT NULL
   AND s.grupo_familiar_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.grupos_familiares g WHERE g.id = b.grupo_familiar_id)
ON CONFLICT DO NOTHING;

ALTER TABLE public.ventas ENABLE TRIGGER trg_ventas_comprador_guard;
ALTER TABLE public.socios ENABLE TRIGGER trg_socios_updated_at;

-- =============================================================================
-- 3. REPORTE
-- =============================================================================
\echo ''
\echo '=== Restauración por tabla ==='
SELECT orden,
       tabla,
       respaldadas,
       insertadas,
       ya_estaban       AS ya_estaban,
       rechazadas,
       presentes_final  AS presentes,
       -- OJO con la tentación de escribir `presentes_final + rechazadas =
       -- respaldadas`: esa igualdad se cumple SIEMPRE por construcción (toda
       -- fila respaldada o está presente o está rechazada), así que una tabla
       -- con 0 insertadas y 1 rechazada salía 'ok'. Es justo el patrón de
       -- "guard que verifica que algo pasó" que este pipeline existe para
       -- erradicar. Lo único que importa acá es si algo NO volvió.
       CASE WHEN descartada AND respaldadas > 0
                 THEN 'descartada (prueba): ' || respaldadas || ' fila(s) quedan sólo en el respaldo'
            WHEN descartada THEN 'descartada (prueba)'
            WHEN rechazadas = 0 THEN 'ok'
            ELSE 'REVISAR: ' || rechazadas || ' fila(s) NO volvieron' END AS cuadre
  FROM respaldo_premigracion.restore_log
 ORDER BY orden;

\echo ''
\echo '=== Filas NO restauradas, por motivo ==='
SELECT tabla, motivo, origen, count(*) AS filas
  FROM respaldo_premigracion.rechazos
 GROUP BY tabla, motivo, origen
 ORDER BY tabla, motivo, origen;

\echo ''
\echo '=== Detalle de rechazos (hasta 200; la tabla completa: respaldo_premigracion.rechazos) ==='
SELECT tabla, id, motivo, detalle
  FROM respaldo_premigracion.rechazos
 ORDER BY tabla, motivo, origen, id
 LIMIT 200;

\echo ''
\echo '=== App móvil: vínculos y invitaciones que apuntan a un socio inexistente ==='
-- Enriquecido con el email de la cuenta: sin el socio no hay nro_socio que
-- mostrar (justamente porque desapareció del dump), pero sí se puede decir
-- QUIÉN es la persona que se quedaría sin vínculo.
SELECT r.tabla,
       r.id,
       coalesce(su.socio_id, si.socio_id) AS socio_id,
       u.email                            AS cuenta,
       si.codigo_prefijo                  AS invitacion_prefijo,
       r.motivo,
       r.detalle
  FROM respaldo_premigracion.rechazos r
  LEFT JOIN respaldo_premigracion.socios_usuarios    su ON r.tabla = 'socios_usuarios'    AND su.id = r.id
  LEFT JOIN respaldo_premigracion.socios_invitaciones si ON r.tabla = 'socios_invitaciones' AND si.id = r.id
  LEFT JOIN auth.users u ON u.id = su.user_id
 WHERE r.tabla IN ('socios_usuarios', 'socios_invitaciones')
 ORDER BY r.tabla, r.id;

-- -----------------------------------------------------------------------------
-- 4. Freno de mano: identidad de usuario no se descarta en silencio.
--    Va DESPUÉS del reporte a propósito: cuando esto aborta, el operador ya
--    tiene impreso arriba el detalle de qué cuentas quedarían colgadas.
--    (socios_invitaciones NO frena: una invitación se re-emite en 10 segundos y
--     su pérdida no deja a nadie sin acceso.)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_n bigint;
BEGIN
  -- count(DISTINCT id), no count(*): `rechazos` guarda una fila por constraint
  -- que falló (su PK incluye `origen`), así que un mismo vínculo que choca
  -- contra los dos índices únicos parciales aparece dos veces. Contar filas
  -- reportaría "2 vínculos" donde hay uno solo. Mismo criterio que el loop
  -- por tabla de más arriba.
  SELECT count(DISTINCT id) INTO v_n FROM respaldo_premigracion.rechazos WHERE tabla = 'socios_usuarios';
  IF v_n = 0 THEN RETURN; END IF;

  IF coalesce(current_setting('migracion.permitir_huerfanos_socios_usuarios', true), 'off') = 'on' THEN
    RAISE WARNING '% vínculo(s) de app móvil NO restaurados (permitido explícitamente). Esas cuentas quedan sin socio: revocarlas o re-vincularlas a mano.', v_n;
    RETURN;
  END IF;

  RAISE EXCEPTION '% vínculo(s) socios_usuarios no se pudieron restaurar (ver el detalle impreso arriba). Se aborta TODO el restore.', v_n
    USING HINT = 'Son cuentas de la app móvil cuyo socio ya no existe en el dump nuevo, o cuya clave única colisiona. Decidí qué pasa con esas personas. Para seguir igual: PGOPTIONS=''-c migracion.permitir_huerfanos_socios_usuarios=on'' psql ... -f migration/restore_datos_erp.sql';
END
$$;

COMMIT;

\echo ''
\echo 'Restore commiteado. El respaldo NO se borró: revisá los números y recién ahí, a mano:'
\echo '    DROP SCHEMA respaldo_premigracion CASCADE;'
