-- =============================================================================
-- clean_demo_seed.sql — Vaciado de las tablas de dominio ANTES de re-migrar
-- el legacy (migration/migrate.py). Se corre desde migration/run_real.sh (1/3).
--
-- ¿POR QUÉ ESTE ARCHIVO DEJÓ DE SER UN TRUNCATE PELADO?
-- -----------------------------------------------------
-- La primera migración (2026-07-24) corrió contra una base que sólo tenía el
-- seed demo: borrar todo era gratis. Desde entonces LA APP ESTUVO EN USO, así
-- que dentro de esas mismas tablas hay filas que NO existen en el legacy y que
-- un TRUNCATE destruye sin vuelta atrás:
--
--   1. `socios_usuarios` / `socios_invitaciones` (…20260813000001_app_movil_socios):
--      el vínculo entre una cuenta de auth y un socio, y las invitaciones vivas
--      de la app móvil. No están en la lista del TRUNCATE, pero SE VACÍAN IGUAL
--      por CASCADE desde `socios`. Esto está verificado empíricamente, no
--      deducido: `TRUNCATE socios ... CASCADE` vacía `socios_usuarios` AUNQUE su
--      FK sea ON DELETE RESTRICT — el modo CASCADE de TRUNCATE suma las tablas
--      referenciantes al conjunto truncado e ignora la acción declarada en la FK.
--      Si alguien busca la línea que las borra, no existe: las borra el CASCADE.
--   2. Las filas nacidas en el ERP nuevo dentro de las 22 tablas truncadas:
--      ventas del POS, sus movimientos de fondos y de stock, socios de alta
--      manual, cuotas generadas desde el sistema nuevo, etc.
--
-- LA PROPIEDAD QUE HACE POSIBLE RESCATARLAS
-- -----------------------------------------
-- migrate.py genera ids DETERMINISTAS: id = uuid5(NS, "tabla:clave_legacy")
-- (migrate.py:29 y :36). Para el mismo NroSocio, el id del socio es IDÉNTICO
-- antes y después de truncar y re-migrar. Entonces una fila dependiente
-- respaldada (una cuota, un vínculo de app móvil) puede reinsertarse después
-- con su FK intacta, porque el socio al que apunta va a volver con el mismo id.
--
-- Y como migrate.py produce uuid VERSIÓN 5 mientras la app usa el DEFAULT
-- gen_random_uuid() (versión 4), el origen de cada fila se lee en el propio id:
--
--     substring(id::text from 15 for 1) = '5'  -> vino del legacy (la re-migración la repone)
--     substring(id::text from 15 for 1) <> '5' -> nació en el ERP  (hay que respaldarla)
--
-- (posición 15 = primer carácter del tercer grupo del uuid = nibble de versión)
--
-- QUÉ HACE ESTE ARCHIVO, EN ORDEN, EN UNA SOLA TRANSACCIÓN
-- --------------------------------------------------------
--   0. Aborta si ya existe un respaldo de una corrida anterior (podría ser el
--      único respaldo de un intento fallido; no se pisa en silencio).
--   1. Arma el plan (qué tablas se vacían y con qué criterio se respaldan).
--   2. Verifica que el CASCADE no alcance ninguna tabla no prevista.
--   3. SNAPSHOT al schema PERSISTENTE `respaldo_premigracion`.
--   4. TRUNCATE de las 22 tablas de dominio.
--   5. Verifica que quedó vacío exactamente lo previsto, ni más ni menos.
--
-- PRESERVA (no se tocan): auth.users, roles, permisos_modulo, usuarios_roles,
-- configuracion, canje_rate_limit.
--
-- DESPUÉS: correr migrate.py y LUEGO migration/restore_datos_erp.sql.
-- El schema `respaldo_premigracion` NO se borra solo: es la red de seguridad.
-- Se borra a mano, y recién cuando la migración esté dada por buena:
--     DROP SCHEMA respaldo_premigracion CASCADE;
--
-- LIMITACIÓN CONOCIDA (decirla ahora y no descubrirla después): se respaldan
-- FILAS nacidas en el ERP, no EDICIONES hechas desde el ERP sobre filas del
-- legacy. Si alguien corrigió el apellido de un socio migrado (uuid v5), la
-- re-migración lo vuelve a pisar con el valor del dump. Eso es intencional: el
-- dump nuevo es la fuente de verdad para todo lo que vino del legacy.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- LOCK — lo PRIMERO, antes de leer una sola fila.
--
-- Sin esto hay una ventana de pérdida silenciosa. Postgres corre en READ
-- COMMITTED: cada sentencia toma su PROPIO snapshot, así que estar dentro de
-- una transacción NO congela nada. Toda fila que la app commitee entre el
-- `CREATE TABLE AS` que respalda su tabla y el momento en que el TRUNCATE
-- consigue el ACCESS EXCLUSIVE se destruye sin quedar respaldada ni
-- reportada — y el chequeo post-vaciado no la puede detectar, porque sólo
-- verifica que las tablas del plan quedaron en 0, que es justo lo que pasa.
--
-- Reproducido:
--   Sesión A: BEGIN; CREATE TABLE backup AS SELECT * FROM t; <pausa>; TRUNCATE t; COMMIT;
--   Sesión B durante la pausa: INSERT INTO t VALUES (99);
--   Resultado: la fila 99 no está ni en backup ni en t. Desapareció.
--
-- La ventana no es teórica: el snapshot copia 22 tablas (~139k cuotas, ~52k
-- movimientos) contra el pooler, o sea decenas de segundos, con el POS y la
-- app móvil operativos.
--
-- Tomar el lock primero también hace que el pipeline falle rápido y limpio si
-- alguien está operando: en vez de corromper, espera o corta por lock_timeout.
-- -----------------------------------------------------------------------------
SET LOCAL lock_timeout = '30s';

LOCK TABLE
  cuotas, socios_actividades, turnos, ventas_items, movimientos_stock,
  movimientos_fondos, stock_inventario, grupos_familiares, ventas,
  socios, clientes, items_ventas, stock_items, depositos, instalaciones,
  actividades, actividades_extras, cajas, categorias_movimientos,
  categorias_sociales, metodos_cobranza, tipos_cuotas,
  socios_invitaciones, socios_usuarios
IN ACCESS EXCLUSIVE MODE;

-- -----------------------------------------------------------------------------
-- 0. ¿Hay un respaldo previo con datos?  ->  frenar y que lo mire una persona.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rel   record;
  v_n     bigint;
  v_total bigint := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'respaldo_premigracion') THEN
    RETURN;
  END IF;

  FOR v_rel IN
    SELECT c.oid::regclass AS reloid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'respaldo_premigracion' AND c.relkind = 'r'
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', v_rel.reloid) INTO v_n;
    v_total := v_total + v_n;
  END LOOP;

  IF v_total > 0 THEN
    RAISE EXCEPTION
      'Ya existe el schema respaldo_premigracion con % filas: es el respaldo de una corrida anterior y NO se pisa automáticamente.',
      v_total
      USING HINT = 'NO borres el respaldo sin mirar primero cuántas filas tienen las tablas de dominio. '
                   'Si socios/cuotas/ventas están VACÍAS, una corrida anterior truncó y no llegó a restaurar: '
                   'este schema es lo ÚNICO que queda de lo nacido en el ERP. En ese caso NO corras este archivo: '
                   'seguí desde el paso 3 (migrate.py) y después el 4 (restore_datos_erp.sql). '
                   'Sólo si las tablas ya tienen datos y existe respaldo_premigracion.restore_log con el detalle '
                   'de una restauración exitosa, el respaldo está de más y se puede borrar con '
                   'DROP SCHEMA respaldo_premigracion CASCADE;';
  END IF;

  -- Existe pero vacío (p.ej. un intento que abortó antes de copiar nada):
  -- no hay nada que perder, se recrea.
  RAISE NOTICE 'respaldo_premigracion existía vacío; se recrea.';
  DROP SCHEMA respaldo_premigracion CASCADE;
END
$$;

CREATE SCHEMA respaldo_premigracion;
COMMENT ON SCHEMA respaldo_premigracion IS
  'Respaldo de las filas nacidas en el ERP (uuid v4) + vínculos de app móvil, tomado antes del TRUNCATE de la re-migración legacy. Lo consume migration/restore_datos_erp.sql. Borrar A MANO recién cuando la migración esté validada.';

-- -----------------------------------------------------------------------------
-- 1. El plan: única fuente de verdad de qué se vacía y qué se respalda.
--
--    orden_restore     = orden de reinserción respetando las FKs (lo lee el restore).
--    criterio_respaldo = 'uuid_v4' -> sólo lo nacido en el ERP (el resto lo repone
--                                     migrate.py con los mismos ids)
--                        'completa'-> la tabla entera (no existe en el legacy:
--                                     si no se respalda, se pierde)
--    motivo_vaciado    = por qué esta tabla va a quedar en 0 filas.
-- -----------------------------------------------------------------------------
CREATE TABLE respaldo_premigracion.manifiesto (
  tabla             text PRIMARY KEY,
  en_plan           boolean NOT NULL,
  orden_restore     int,
  criterio_respaldo text,
  motivo_vaciado    text,
  filas_antes       bigint,
  filas_respaldadas bigint NOT NULL DEFAULT 0,
  filas_despues     bigint,
  creado_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE respaldo_premigracion.manifiesto IS
  'Una fila por tabla de public: conteos antes/después del TRUNCATE y, para las del plan, el criterio de respaldo y el orden de reinserción.';

INSERT INTO respaldo_premigracion.manifiesto
  (tabla, en_plan, orden_restore, criterio_respaldo, motivo_vaciado)
VALUES
  -- Catálogos sin dependencias (una categoría o una caja creada desde el ERP
  -- no está en el dump: si se pierde, los movimientos que la usan quedan sueltos).
  ('categorias_sociales',    true,  1, 'uuid_v4',  'truncate_explicito'),
  ('metodos_cobranza',       true,  2, 'uuid_v4',  'truncate_explicito'),
  ('tipos_cuotas',           true,  3, 'uuid_v4',  'truncate_explicito'),
  ('cajas',                  true,  4, 'uuid_v4',  'truncate_explicito'),
  ('categorias_movimientos', true,  5, 'uuid_v4',  'truncate_explicito'),
  ('instalaciones',          true,  6, 'uuid_v4',  'truncate_explicito'),
  ('actividades',            true,  7, 'uuid_v4',  'truncate_explicito'),
  ('actividades_extras',     true,  8, 'uuid_v4',  'truncate_explicito'),
  ('clientes',               true,  9, 'uuid_v4',  'truncate_explicito'),
  ('stock_items',            true, 10, 'uuid_v4',  'truncate_explicito'),
  -- Dependen de los catálogos
  ('depositos',              true, 11, 'uuid_v4',  'truncate_explicito'),  -- -> cajas
  ('items_ventas',           true, 12, 'uuid_v4',  'truncate_explicito'),  -- -> stock_items
  -- socios y grupos_familiares son un CICLO de FKs (socios.grupo_familiar_id <->
  -- grupos_familiares.titular_id). El restore inserta socios con
  -- grupo_familiar_id en NULL y lo completa al final; por eso socios va primero.
  ('socios',                 true, 13, 'uuid_v4',  'truncate_explicito'),
  ('grupos_familiares',      true, 14, 'uuid_v4',  'truncate_explicito'),
  -- Movimiento / transaccional
  ('stock_inventario',       true, 15, 'uuid_v4',  'truncate_explicito'),
  ('cuotas',                 true, 16, 'uuid_v4',  'truncate_explicito'),
  ('turnos',                 true, 17, 'uuid_v4',  'truncate_explicito'),
  ('socios_actividades',     true, 18, 'uuid_v4',  'truncate_explicito'),
  ('ventas',                 true, 19, 'uuid_v4',  'truncate_explicito'),
  ('movimientos_fondos',     true, 20, 'uuid_v4',  'truncate_explicito'),
  ('movimientos_stock',      true, 21, 'uuid_v4',  'truncate_explicito'),
  ('ventas_items',           true, 22, 'uuid_v4',  'truncate_explicito'),
  -- App móvil: NO están en el TRUNCATE, caen por CASCADE desde socios.
  -- Se respaldan COMPLETAS porque nada de esto existe en el legacy: si se
  -- pierden, no hay de dónde recuperar qué socio tiene cuenta activa.
  ('socios_invitaciones',    true, 23, 'completa', 'cascade_desde_socios'),
  ('socios_usuarios',        true, 24, 'completa', 'cascade_desde_socios');

-- -----------------------------------------------------------------------------
-- 2. Guardia: ¿el CASCADE alcanza alguna tabla que no está en el plan?
--
--    Si mañana alguien agrega una tabla con FK a socios (o a ventas, o a
--    cualquiera de las 22) y no la suma acá, el TRUNCATE se la lleva puesta en
--    silencio — exactamente el bug que este archivo existe para no repetir.
--    Este bloque hace el cierre transitivo de "quién referencia a quién" y
--    frena si aparece algo inesperado.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_inesperadas text;
BEGIN
  WITH RECURSIVE clausura AS (
    SELECT format('public.%I', tabla)::regclass AS reloid
      FROM respaldo_premigracion.manifiesto
     WHERE motivo_vaciado = 'truncate_explicito'
    UNION
    SELECT c.conrelid::regclass
      FROM pg_constraint c
      JOIN clausura cl ON c.confrelid = cl.reloid::oid
     WHERE c.contype = 'f'
  )
  SELECT string_agg(DISTINCT cl.reloid::text, ', ')
    INTO v_inesperadas
    FROM clausura cl
   WHERE cl.reloid NOT IN (
           SELECT format('public.%I', tabla)::regclass
             FROM respaldo_premigracion.manifiesto WHERE en_plan
         );

  IF v_inesperadas IS NOT NULL THEN
    RAISE EXCEPTION
      'El TRUNCATE CASCADE alcanzaría tablas fuera del plan: %', v_inesperadas
      USING HINT = 'Alguien agregó una FK contra las tablas de dominio. Decidí si esos datos se respaldan (sumalos al manifiesto y a restore_datos_erp.sql) o si se pueden perder, y recién ahí volvé a correr.';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 3. Snapshot + conteos previos de TODAS las tablas de public.
--    (los conteos de las que no están en el plan son la línea de base del
--     paso 5: si alguna se vacía sin estar prevista, hay que enterarse)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rel    record;
  v_filtro text;
  v_n      bigint;
BEGIN
  -- 3a. conteos previos de todo public
  FOR v_rel IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_rel.relname) INTO v_n;
    INSERT INTO respaldo_premigracion.manifiesto (tabla, en_plan, filas_antes)
    VALUES (v_rel.relname, false, v_n)
    ON CONFLICT (tabla) DO UPDATE SET filas_antes = EXCLUDED.filas_antes;
  END LOOP;

  -- 3b. copia física de lo que hay que rescatar
  FOR v_rel IN
    SELECT tabla, criterio_respaldo
      FROM respaldo_premigracion.manifiesto
     WHERE en_plan ORDER BY orden_restore
  LOOP
    -- Posición 15 del uuid = nibble de versión. '4' = gen_random_uuid() = la app.
    v_filtro := CASE v_rel.criterio_respaldo
                  -- '<> 5', no '= 4': el criterio es "todo lo que la re-migración
                  -- NO va a reponer". Con '= 4', una fila con cualquier otra
                  -- versión de uuid (v1, v7, una carga manual) se truncaba sin
                  -- respaldar y sin reportar. preflight.sql las cuenta, pero
                  -- contar no es respaldar.
                  WHEN 'uuid_v4' THEN 'WHERE substring(id::text from 15 for 1) <> ''5'''
                  ELSE ''
                END;
    EXECUTE format('CREATE TABLE respaldo_premigracion.%I AS SELECT * FROM public.%I %s',
                   v_rel.tabla, v_rel.tabla, v_filtro);
    -- El índice no es adorno: el restore hace EXISTS/NOT EXISTS por id sobre
    -- estas tablas y CREATE TABLE AS no hereda la PK.
    EXECUTE format('CREATE UNIQUE INDEX ON respaldo_premigracion.%I (id)', v_rel.tabla);

    EXECUTE format('SELECT count(*) FROM respaldo_premigracion.%I', v_rel.tabla) INTO v_n;
    UPDATE respaldo_premigracion.manifiesto
       SET filas_respaldadas = v_n
     WHERE tabla = v_rel.tabla;

    RAISE NOTICE 'respaldo % (%): % filas', v_rel.tabla, v_rel.criterio_respaldo, v_n;
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 4. El vaciado.
--
--    La lista es LITERAL a propósito: es la sentencia destructiva del archivo y
--    tiene que poder leerse sin ejecutar nada. Que coincida con el plan lo
--    verifica el paso 5 (en los dos sentidos).
--    socios_invitaciones y socios_usuarios NO se nombran: caen por CASCADE
--    desde socios, ya están respaldadas completas más arriba.
-- -----------------------------------------------------------------------------
TRUNCATE
  cuotas, socios_actividades, turnos, ventas_items, movimientos_stock,
  movimientos_fondos, stock_inventario, grupos_familiares, ventas,
  socios, clientes, items_ventas, stock_items, depositos, instalaciones,
  actividades, actividades_extras, cajas, categorias_movimientos,
  categorias_sociales, metodos_cobranza, tipos_cuotas
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- 5. Verificación post-vaciado, en los dos sentidos:
--      (a) toda tabla del plan tiene que haber quedado en 0
--          -> si no, el TRUNCATE literal se quedó corto respecto del plan
--      (b) ninguna tabla FUERA del plan que tenía filas puede haber quedado en 0
--          -> si pasa, algo se vació sin estar previsto ni respaldado
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rel  record;
  v_n    bigint;
  v_mal  text;
BEGIN
  FOR v_rel IN SELECT tabla FROM respaldo_premigracion.manifiesto LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_rel.tabla) INTO v_n;
    UPDATE respaldo_premigracion.manifiesto SET filas_despues = v_n WHERE tabla = v_rel.tabla;
  END LOOP;

  SELECT string_agg(tabla || '=' || filas_despues, ', ')
    INTO v_mal
    FROM respaldo_premigracion.manifiesto
   WHERE en_plan AND filas_despues > 0;
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas del plan que NO quedaron vacías: %', v_mal
      USING HINT = 'La lista literal del TRUNCATE no cubre todo el plan. Corregí el TRUNCATE de este mismo archivo.';
  END IF;

  SELECT string_agg(tabla || ' (tenía ' || filas_antes || ')', ', ')
    INTO v_mal
    FROM respaldo_premigracion.manifiesto
   WHERE NOT en_plan AND filas_antes > 0 AND filas_despues = 0;
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'Se vaciaron tablas que NO estaban previstas: %', v_mal
      USING HINT = 'Se perdieron datos no respaldados. NO commitear: revisá el plan y la lista del TRUNCATE.';
  END IF;

  RAISE NOTICE 'Vaciado OK. Respaldo en respaldo_premigracion (% filas en total). Después de migrate.py: correr migration/restore_datos_erp.sql',
    (SELECT coalesce(sum(filas_respaldadas), 0) FROM respaldo_premigracion.manifiesto);
END
$$;

COMMIT;

-- Resumen para el operador (lo que se respaldó y lo que se vació).
SELECT tabla,
       criterio_respaldo AS criterio,
       motivo_vaciado    AS vaciado_por,
       filas_antes       AS antes,
       filas_respaldadas AS respaldadas,
       filas_despues     AS despues
  FROM respaldo_premigracion.manifiesto
 WHERE en_plan
 ORDER BY orden_restore;
