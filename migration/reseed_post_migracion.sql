-- =============================================================================
-- reseed_post_migracion.sql — repone la POLÍTICA DEL CLUB que el TRUNCATE
--                              se lleva y que el dump legacy no puede reponer
--
-- CUÁNDO SE CORRE: inmediatamente DESPUÉS de migrate.py.
--   1) migration/clean_demo_seed.sql  -> snapshot en `respaldo_premigracion` + TRUNCATE de 22 tablas
--   2) migrate.py                     -> repuebla el legacy (uuid v5 determinista)
--   3) ESTE ARCHIVO                   -> repone los invariantes de configuración
--   4) migration/restore_datos_erp.sql -> devuelve lo nacido en el ERP (uuid v4)
--
--   PGPASSWORD=... /usr/local/opt/libpq/bin/psql "$CONN" -v ON_ERROR_STOP=1 \
--       -f migration/reseed_post_migracion.sql
--
--   Se corre con el rol dueño de la base (postgres), como sus hermanos: escribe
--   tablas con RLS activa y no pasa por auth.uid().
--
-- POR QUÉ EXISTE
-- --------------
-- La regla de separación del pipeline: **migrate.py es un traductor puro del
-- dump legacy** — sólo escribe valores que se pueden derivar leyendo el dump.
-- Todo lo que sea decisión del club POSTERIOR al legacy (qué categorías votan,
-- qué caja cobra cada mostrador, qué categorías de tesorería necesita el POS)
-- no está en el dump y no puede salir de ahí. Vive acá.
--
-- Esas decisiones se habían escrito como seeds dentro de migraciones de
-- `supabase/migrations/`. Una migración corre UNA vez: ya está en el ledger, y
-- el TRUNCATE de la re-migración vacía las tablas que ella sembró sin que
-- vuelva a ejecutarse. El estado se pierde EN SILENCIO — nada falla, nada
-- avisa, y el síntoma aparece semanas después (un padrón incompleto el día de
-- la asamblea, ventas que no impactan tesorería). Este archivo es lo que
-- convierte esas pérdidas silenciosas en un error ruidoso o en un dato repuesto.
--
-- CÓMO ESTÁ ESCRITO
-- -----------------
-- * TODO en UNA transacción. Un RAISE EXCEPTION en cualquier fragmento aborta
--   el archivo entero: es preferible "no corrió nada" (y se vuelve a correr)
--   a "quedaron 3 de 5 invariantes" sin que nadie sepa cuáles.
-- * IDEMPOTENTE: correrlo dos veces no cambia nada ni falla.
-- * GUARDS DE CONTEO EXACTO y por IDENTIDAD, nunca "no vacío". El bug que este
--   archivo existe para no repetir fue justamente un guard `count(*) = 0`:
--   6 de 8 categorías matchearon y el deploy pasó en verde (ver Fragmento 2).
-- * SIEMBRA POR ID, NO POR NOMBRE. Los nombres del legacy tienen typos, dobles
--   espacios y variantes de puntuación; los ids uuid5 que genera migrate.py son
--   exactos y estables. Un WHERE por nombre que no matchea no da error: deja
--   el invariante sin aplicar.
--
-- SOBRE LOS UUID LITERALES
-- ------------------------
-- migrate.py deriva cada id como uuid5(NS, "<tabla>:<clave_legacy>") con
-- NS = a1b2c3d4-0000-4000-8000-a7a7a7a70001 (migrate.py:29 y :36).
-- Postgres NO tiene uuid5(), y esta base no tiene uuid-ossp ni pgcrypto
-- instaladas (sólo plpgsql), así que los ids van como LITERALES calculados
-- fuera, con el mapa de identidad al lado en comentario. Para recomputar y
-- verificar cualquiera de ellos:
--
--   python3 -c "import uuid; NS=uuid.UUID('a1b2c3d4-0000-4000-8000-a7a7a7a70001'); \
--               print(uuid.uuid5(NS,'categorias_sociales:3'))"
--
-- Si migrate.py cambiara el namespace o la forma de la clave, TODOS los
-- literales de este archivo dejan de valer y los guards van a abortar. Es el
-- comportamiento buscado: abortan, no siguen de largo.
--
-- LO QUE **NO** ESTÁ ACÁ, A PROPÓSITO
-- -----------------------------------
-- * App móvil (`socios_usuarios`, `socios_invitaciones`): ya resuelto por
--   migration/clean_demo_seed.sql (snapshot antes del TRUNCATE) +
--   migration/restore_datos_erp.sql (reinserción). No se duplica acá.
-- * `categorias_sociales.cuenta_como_activo` (BAJA / Inactivo en false, seed de
--   20260806000001_dashboard_metrics.sql): lo repone migrate.py mismo, que lo
--   deriva del nombre de la categoría del dump (migrate.py:116 y :128). Es dato
--   derivable del legacy, así que del lado del traductor está bien.
-- * El recargo del 20% a no socios: está acá pero NO se aplica solo. Ver
--   Fragmento 5 y su opt-in explícito.
-- =============================================================================

BEGIN;

SET LOCAL search_path = public, pg_temp;

-- Acumulador del resumen final. ON COMMIT DROP: no ensucia la sesión ni choca
-- con una segunda corrida.
CREATE TEMP TABLE _reseed_resumen (
  orden      int,
  fragmento  text,
  estado     text,   -- OK | SIN CAMBIOS | REVISAR | REPORTE
  detalle    text
) ON COMMIT DROP;


-- =============================================================================
-- FRAGMENTO 1 — Categorías de tesorería que necesita el POS
--
-- ORIGEN : supabase/migrations/20260803000001_puntos_venta_schema.sql:49-52
-- REPONE : las filas ('Ventas','ingreso') y ('Anulación de Ventas','egreso')
--          de categorias_movimientos.
-- SI FALTA: registrar_venta() hace
--             RAISE EXCEPTION 'Falta la categoría de ingreso "Ventas" en tesorería'
--           (20260812000001_items_ventas_precio_no_socio.sql:450-453) y el POS
--           queda caído: no se puede vender. anular_venta() falla igual con
--           'Anulación de Ventas' (20260803000002_stock_ventas_rpcs.sql:363-364).
--
-- POR QUÉ NO VIENE DEL LEGACY: verificado contra el dump — la tabla `categorias`
-- del legacy no tiene ninguna fila con estos nombres. Lo más parecido es
-- ('ANULACION VENTA', tipo 'S'), que NO es el string que busca la RPC. Las dos
-- categorías son un invento del ERP nuevo, así que migrate.py no las puede
-- traer y tras el TRUNCATE simplemente no están.
--
-- LOS NOMBRES SON LITERALES EXACTOS, incluido el acento de 'Anulación'. La RPC
-- compara con `=`, no con unaccent ni ILIKE: 'Anulacion de Ventas' no matchea.
-- =============================================================================

INSERT INTO categorias_movimientos (nombre, tipo, activa) VALUES
  ('Ventas',              'ingreso', true),
  ('Anulación de Ventas', 'egreso',  true)
ON CONFLICT (nombre, tipo) DO NOTHING;

DO $frag1$
DECLARE
  v_faltan  text;
  v_presentes int;
  v_inactivas text;
BEGIN
  -- Guard por IDENTIDAD y conteo exacto: las dos filas, con el nombre y el
  -- tipo exactos que buscan las RPCs. No alcanza con "hay categorías".
  SELECT string_agg(format('(%L, %L)', e.nombre, e.tipo), ', ' ORDER BY e.nombre)
    INTO v_faltan
    FROM (VALUES ('Ventas', 'ingreso'), ('Anulación de Ventas', 'egreso')) AS e(nombre, tipo)
    LEFT JOIN categorias_movimientos cm
           ON cm.nombre = e.nombre AND cm.tipo = e.tipo
   WHERE cm.id IS NULL;

  SELECT count(*) INTO v_presentes
    FROM categorias_movimientos cm
    JOIN (VALUES ('Ventas', 'ingreso'), ('Anulación de Ventas', 'egreso')) AS e(nombre, tipo)
      ON cm.nombre = e.nombre AND cm.tipo = e.tipo;

  IF v_presentes <> 2 THEN
    RAISE EXCEPTION
      'Fragmento 1: se esperaban 2 categorías de movimiento y hay %. Faltan: %',
      v_presentes, coalesce(v_faltan, '(ninguna: hay duplicados?)');
  END IF;

  -- Una categoría desactivada no rompe la RPC (no filtra por `activa`), pero sí
  -- desaparece de los combos de tesorería. Se avisa, no se pisa: desactivarla
  -- puede haber sido una decisión.
  SELECT string_agg(cm.nombre, ', ' ORDER BY cm.nombre) INTO v_inactivas
    FROM categorias_movimientos cm
    JOIN (VALUES ('Ventas', 'ingreso'), ('Anulación de Ventas', 'egreso')) AS e(nombre, tipo)
      ON cm.nombre = e.nombre AND cm.tipo = e.tipo
   WHERE NOT cm.activa;

  IF v_inactivas IS NOT NULL THEN
    RAISE WARNING 'Fragmento 1: categorías presentes pero INACTIVAS: %', v_inactivas;
    INSERT INTO _reseed_resumen VALUES (1, 'categorias_movimientos del POS', 'REVISAR',
      format('2/2 presentes, pero inactivas: %s', v_inactivas));
  ELSE
    INSERT INTO _reseed_resumen VALUES (1, 'categorias_movimientos del POS', 'OK',
      '2/2 presentes y activas: (Ventas, ingreso) y (Anulación de Ventas, egreso)');
  END IF;
END;
$frag1$;


-- =============================================================================
-- FRAGMENTO 2 — habilita_voto: las 8 categorías con derecho a voto
--
-- ORIGEN : supabase/migrations/20260817000001_padron_electoral.sql:38-46
-- REPONE : categorias_sociales.habilita_voto = true en las 8 categorías que
--          fijó el club el 2026-08-17.
-- SI FALTA: /socios/padron emite el padrón electoral SIN esos socios. No hay
--          error, no hay pantalla en rojo: la lista sale más corta y se firma
--          igual. Con habilita_voto en 0 categorías el padrón sale vacío.
--
-- POR QUÉ NO SE SIEMBRA POR NOMBRE — ESTO YA FALLÓ EN PRODUCCIÓN
-- --------------------------------------------------------------
-- El seed original hace `WHERE upper(btrim(nombre)) IN (...)` y matcheó 6 de 8:
--   * busca 'GRUPO FAMILIA'                   — el legacy dice 'Grupo Familiar' (con R)
--   * busca 'GRUPO FLIAR. MIEMBRO-VENTANILLA' — el legacy dice
--     'Grupo Fliar. Miembro  - Ventanilla'    (DOBLE espacio + guion espaciado)
-- Su guard era `IF count(*) = 0 THEN RAISE`, así que 6 de 8 pasó como OK y el
-- deploy quedó verde con dos categorías enteras sin voto. Los nombres del
-- legacy no se pueden tipear de memoria: se siembra por id.
--
-- ASIMETRÍA DELIBERADA DE LOS GUARDS
-- ----------------------------------
--   * FALTA una de las 8  -> EXCEPTION (aborta todo). Un socio que debía votar
--     y no vota es invisible: nadie mira una lista para ver quién NO está.
--   * SOBRA una novena    -> WARNING con nombre. Puede ser una categoría creada
--     legítimamente después (el CRUD permite marcarla), y restore_datos_erp.sql
--     puede reinsertar categorías nacidas en el ERP con su flag. Se avisa y se
--     deja pasar, porque una categoría de más SÍ se ve en el padrón.
-- =============================================================================

UPDATE categorias_sociales
   SET habilita_voto = true
 WHERE id IN (
   '8afa4fe8-b3aa-5d57-be5d-703732fe9cad',  -- id_legacy= 3  Activo
   '2c774b62-8921-54ec-b68b-9ce47295599a',  -- id_legacy= 4  Vitalicio
   '499f21a5-877d-5fa7-8b95-8fa2be1ac8f3',  -- id_legacy= 6  Honorario
   'd0df2807-a5c5-510c-8f8d-9085adbde1bf',  -- id_legacy=12  Grupo Familiar
   '721649cb-dcd8-528e-b34d-54bc443ae43e',  -- id_legacy=13  Activo-Ventanilla
   '82124670-1178-529f-97f9-04de86c3319d',  -- id_legacy=16  Grupo Familiar-Ventanilla
   '4f3ad3be-1b2b-5b93-87c8-6b8bf2ad2b02',  -- id_legacy=20  Grupo Fliar. Miembro
   'dee95915-198c-5de2-bf46-2b242727c36d'   -- id_legacy=21  Grupo Fliar. Miembro  - Ventanilla
 )
   AND NOT habilita_voto;   -- sin esto el UPDATE reescribe filas ya correctas

DO $frag2$
DECLARE
  -- Mismo mapa que el UPDATE de arriba, con el nombre esperado al lado: es lo
  -- que permite que el mensaje de error diga QUÉ falta y no sólo cuántas.
  v_esperadas CONSTANT text[][] := ARRAY[
    ['8afa4fe8-b3aa-5d57-be5d-703732fe9cad', 'Activo'],
    ['2c774b62-8921-54ec-b68b-9ce47295599a', 'Vitalicio'],
    ['499f21a5-877d-5fa7-8b95-8fa2be1ac8f3', 'Honorario'],
    ['d0df2807-a5c5-510c-8f8d-9085adbde1bf', 'Grupo Familiar'],
    ['721649cb-dcd8-528e-b34d-54bc443ae43e', 'Activo-Ventanilla'],
    ['82124670-1178-529f-97f9-04de86c3319d', 'Grupo Familiar-Ventanilla'],
    ['4f3ad3be-1b2b-5b93-87c8-6b8bf2ad2b02', 'Grupo Fliar. Miembro'],
    ['dee95915-198c-5de2-bf46-2b242727c36d', 'Grupo Fliar. Miembro  - Ventanilla']
  ];
  v_ok      int;
  v_faltan  text;
  v_extras  text;
  v_total   int;
BEGIN
  WITH esperadas AS (
    SELECT (v_esperadas[i][1])::uuid AS id, v_esperadas[i][2] AS nombre_legacy
      FROM generate_subscripts(v_esperadas, 1) AS i
  ),
  estado AS (
    SELECT e.id, e.nombre_legacy, cs.id IS NOT NULL AS existe,
           coalesce(cs.habilita_voto, false) AS vota
      FROM esperadas e
      LEFT JOIN categorias_sociales cs ON cs.id = e.id
  )
  SELECT count(*) FILTER (WHERE vota),
         string_agg(
           CASE WHEN NOT existe
                THEN format('%s [id %s: LA CATEGORÍA NO EXISTE en la base]', nombre_legacy, id)
                ELSE format('%s [id %s: existe pero quedó en false]', nombre_legacy, id)
           END, E'\n           ' ORDER BY nombre_legacy)
           FILTER (WHERE NOT vota)
    INTO v_ok, v_faltan
    FROM estado;

  IF v_ok <> 8 THEN
    RAISE EXCEPTION E'Fragmento 2: se esperaban 8 categorías con habilita_voto y hay %.\nFaltan:\n           %',
      v_ok, v_faltan
      USING HINT = 'Si "LA CATEGORÍA NO EXISTE", el dump legacy cambió de ids: '
                   'recomputar los uuid5 con migrate.py:36 y actualizar este archivo. '
                   'No parchear a mano en la base.';
  END IF;

  -- Novena categoría con voto: se avisa, no aborta (ver asimetría arriba).
  SELECT count(*),
         string_agg(cs.nombre, ', ' ORDER BY cs.nombre)
           FILTER (WHERE cs.id <> ALL (
             SELECT (v_esperadas[i][1])::uuid FROM generate_subscripts(v_esperadas, 1) AS i))
    INTO v_total, v_extras
    FROM categorias_sociales cs
   WHERE cs.habilita_voto;

  IF v_extras IS NOT NULL THEN
    RAISE WARNING 'Fragmento 2: hay % categorías con voto (se esperaban 8). Fuera del mapa: %',
      v_total, v_extras;
    INSERT INTO _reseed_resumen VALUES (2, 'habilita_voto (padrón electoral)', 'REVISAR',
      format('8/8 del mapa OK, pero hay %s con voto en total. Fuera del mapa: %s', v_total, v_extras));
  ELSE
    INSERT INTO _reseed_resumen VALUES (2, 'habilita_voto (padrón electoral)', 'OK',
      '8/8 categorías del club marcadas, y ninguna de más');
  END IF;
END;
$frag2$;


-- =============================================================================
-- FRAGMENTO 3 — afecta_padron: el tipo de cuota que inhabilita a votar
--
-- ORIGEN : supabase/migrations/20260817000001_padron_electoral.sql:59-67
-- REPONE : tipos_cuotas.afecta_padron = true en 'Cuota Social' (idTipoCuota=1).
-- SI FALTA: el criterio "al día" del padrón desaparece EN SILENCIO. get_padron
--          calcula el período de corte con padron_periodo_corte(), que filtra
--          por afecta_padron: sin ningún tipo marcado, v_corte queda NULL, el
--          NOT EXISTS de deuda nunca excluye a nadie y el padrón HABILITA A
--          TODO MOROSO. Es el error más caro de los cinco: no se ve mirando la
--          pantalla, sale más gente habilitada de la que corresponde.
--
-- Los otros dos tipos del legacy (3 'Cuota Adherente', 4 'Cuota Escuela') NO
-- afectan el padrón: sólo la cuota social. Por eso el conteo esperado es 1 y
-- no "al menos 1".
-- =============================================================================

UPDATE tipos_cuotas
   SET afecta_padron = true
 WHERE id = '5139448f-57ff-5234-bf30-ddfefd0f3ab8'  -- id_legacy=1  Cuota Social
   AND NOT afecta_padron;

DO $frag3$
DECLARE
  v_id CONSTANT uuid := '5139448f-57ff-5234-bf30-ddfefd0f3ab8';
  v_existe boolean;
  v_vota   boolean;
  v_total  int;
  v_extras text;
BEGIN
  SELECT true, tc.afecta_padron INTO v_existe, v_vota
    FROM tipos_cuotas tc WHERE tc.id = v_id;

  IF NOT coalesce(v_existe, false) THEN
    RAISE EXCEPTION 'Fragmento 3: no existe el tipo de cuota "Cuota Social" (id %, id_legacy=1)', v_id
      USING HINT = 'El dump legacy no trajo TipoCuota 1, o migrate.py no corrió la etapa tipos_cuotas.';
  END IF;

  IF NOT v_vota THEN
    RAISE EXCEPTION 'Fragmento 3: "Cuota Social" (id %) existe pero quedó con afecta_padron = false', v_id;
  END IF;

  SELECT count(*), string_agg(tc.nombre, ', ' ORDER BY tc.nombre) FILTER (WHERE tc.id <> v_id)
    INTO v_total, v_extras
    FROM tipos_cuotas tc WHERE tc.afecta_padron;

  IF v_total <> 1 THEN
    RAISE WARNING 'Fragmento 3: hay % tipos de cuota con afecta_padron (se esperaba 1). Además de Cuota Social: %',
      v_total, coalesce(v_extras, '(ninguno)');
    INSERT INTO _reseed_resumen VALUES (3, 'afecta_padron (tipo de cuota)', 'REVISAR',
      format('Cuota Social OK, pero hay %s tipos marcados. Extras: %s', v_total, coalesce(v_extras, '-')));
  ELSE
    INSERT INTO _reseed_resumen VALUES (3, 'afecta_padron (tipo de cuota)', 'OK',
      '1/1: Cuota Social (id_legacy=1)');
  END IF;
END;
$frag3$;


-- =============================================================================
-- FRAGMENTO 4 — depositos.caja_id: qué caja cobra cada punto de venta
--
-- ORIGEN : supabase/migrations/20260803000001_puntos_venta_schema.sql:63-68
--          supabase/migrations/20260803000004_puntos_venta_ajuste_prod.sql:25-31
-- REPONE : el vínculo punto de venta -> caja de tesorería.
-- SI FALTA: registrar_venta() OMITE EL MOVIMIENTO DE FONDOS EN SILENCIO
--          (20260812000001:449 — `IF v_pdv.caja_id IS NOT NULL ... THEN`). La
--          venta se registra, el stock baja, el ticket sale, y la plata NUNCA
--          aparece en tesorería. No hay excepción, no hay log: la caja
--          simplemente cierra corta y nadie sabe por qué.
--
-- POR QUÉ NO SE EMPAREJA POR NOMBRE
-- ---------------------------------
-- El original hace `lower(btrim(c.nombre)) = lower(btrim(d.nombre))` entre
-- depositos y cajas — el mismo patrón frágil que ya falló en el Fragmento 2.
-- Acá van pares EXPLÍCITOS por id legacy.
--
-- QUÉ CREA MIGRATE.PY Y QUÉ NO (verificado contra el dump y contra migrate.py)
-- ---------------------------------------------------------------------------
-- La tabla `Deposito` del legacy tiene 4 filas y migrate.py:377-393 las importa
-- TODAS con id uuid5("depositos:<idDeposito>"), marcando tipo='punto_venta' a
-- toda la que no tenga "deposito" en el nombre:
--     1 Deposito Central -> tipo 'deposito'
--     2 Tiro Practico    -> tipo 'punto_venta'
--     3 Secretaria       -> tipo 'punto_venta'
--     4 Arma Corta       -> tipo 'punto_venta'
-- O sea: los tres puntos de venta EXISTEN tras migrate.py, con id determinista.
-- No hay que crear ninguno. (Las filas que insertaba 20260803000001:58-62 sin
-- id explícito nacían con uuid v4 y desaparecieron con el TRUNCATE; sus
-- equivalentes vuelven por el lado del legacy, con otro id. Por eso este
-- fragmento no busca por nombre ni recrea nada.)
-- migrate.py:397-415 (default_punto_venta) sólo inventaría un PdV si el legacy
-- no hubiera traído ninguno; con 3 importados, ese camino no se toma.
--
-- Las `cajas` legacy relevantes (migrate.py:522-534, id uuid5("cajas:<id>")):
--     18 Secretaria   19 Arma Corta
-- (el resto —Prueba, CC Santander, las cajas fuertes, AJUSTES CAJAS X SISTEMA,
--  etc.— no son mostradores de venta).
--
-- 'TIRO PRACTICO' QUEDA SIN CAJA, Y NO ES UNA REGRESIÓN
-- ----------------------------------------------------
-- El legacy NO tiene ninguna caja llamada 'Tiro Practico', así que el
-- emparejamiento por nombre del original tampoco lo vinculaba: en producción
-- hoy está exactamente así, con caja_id NULL. Se documenta acá para que quien
-- lea el resumen no lo interprete como una falla de este script. Consecuencia
-- real y conocida: las ventas cargadas en ese PdV no impactan tesorería. Si el
-- club decide que sí debe hacerlo, hay que elegirle una caja y agregar el par
-- a la lista de abajo — no hay forma de adivinarlo desde el dump.
--
-- GUARD: 3 puntos de venta, 2 con caja (Secretaria, Arma Corta), 1 sin caja
-- (Tiro Practico). Los dos pares son EXCEPTION si no quedan vinculados; el
-- censo total es WARNING, porque un PdV nuevo creado desde el ERP es legítimo.
-- =============================================================================

-- 4.a Asegurar el tipo. registrar_venta rechaza la venta con 'Punto de venta
--     inválido o inactivo' si tipo <> 'punto_venta' (20260812000001:357-361),
--     así que un mostrador mal tipado no vende. La heurística de migrate.py
--     depende del nombre del dump; acá se fija por id.
UPDATE depositos
   SET tipo = 'punto_venta'
 WHERE id IN (
   '68128553-0410-5524-a0a0-8d4dd3c147b3',  -- id_legacy=2  Tiro Practico
   'dea337fb-43ae-5be2-ada7-5a9e9ae20698',  -- id_legacy=3  Secretaria
   '893ef8ea-71c2-5cda-87e5-ad75394bb1ea'   -- id_legacy=4  Arma Corta
 )
   AND tipo <> 'punto_venta';

-- 4.b Vincular. Sólo donde caja_id está en NULL: si alguien ya re-apuntó un
--     mostrador a otra caja a mano, esa decisión gana (y se reporta abajo).
UPDATE depositos d
   SET caja_id = p.caja_id
  FROM (VALUES
    -- deposito (id_legacy, nombre)                caja (id_legacy, nombre)
    ('dea337fb-43ae-5be2-ada7-5a9e9ae20698'::uuid, -- dep 3  Secretaria
     '1a8f8366-d5f1-5fbc-aeac-82a2be892833'::uuid), -- caja 18 Secretaria
    ('893ef8ea-71c2-5cda-87e5-ad75394bb1ea'::uuid, -- dep 4  Arma Corta
     'b434f5a8-e317-5540-9534-173f533ecf64'::uuid)  -- caja 19 Arma Corta
  ) AS p(deposito_id, caja_id)
 WHERE d.id = p.deposito_id
   AND d.caja_id IS NULL
   AND EXISTS (SELECT 1 FROM cajas c WHERE c.id = p.caja_id);

DO $frag4$
DECLARE
  v_pares CONSTANT text[][] := ARRAY[
    ['dea337fb-43ae-5be2-ada7-5a9e9ae20698', '1a8f8366-d5f1-5fbc-aeac-82a2be892833', 'Secretaria'],
    ['893ef8ea-71c2-5cda-87e5-ad75394bb1ea', 'b434f5a8-e317-5540-9534-173f533ecf64', 'Arma Corta']
  ];
  v_problemas text;
  v_desviados text;
  v_con_caja  int;
  v_sin_caja  int;
  v_nom_con   text;
  v_nom_sin   text;
BEGIN
  -- Guard duro: los dos pares esperados tienen que quedar vinculados. El
  -- mensaje distingue las tres causas posibles, que se arreglan distinto.
  WITH pares AS (
    SELECT (v_pares[i][1])::uuid AS dep_id, (v_pares[i][2])::uuid AS caja_id, v_pares[i][3] AS nombre
      FROM generate_subscripts(v_pares, 1) AS i
  )
  SELECT string_agg(
           CASE
             WHEN d.id IS NULL THEN
               format('%s: NO EXISTE el depósito (id %s)', p.nombre, p.dep_id)
             WHEN c.id IS NULL AND d.caja_id IS NULL THEN
               format('%s: NO EXISTE la caja (id %s), el depósito quedó sin vincular', p.nombre, p.caja_id)
             ELSE
               format('%s: el depósito existe pero quedó con caja_id NULL', p.nombre)
           END, E'\n           ' ORDER BY p.nombre)
    INTO v_problemas
    FROM pares p
    LEFT JOIN depositos d ON d.id = p.dep_id
    LEFT JOIN cajas     c ON c.id = p.caja_id
   WHERE d.id IS NULL OR d.caja_id IS NULL;

  IF v_problemas IS NOT NULL THEN
    RAISE EXCEPTION E'Fragmento 4: hay puntos de venta sin caja de tesorería.\n           %', v_problemas
      USING HINT = 'Sin caja, registrar_venta omite el movimiento de fondos en silencio. '
                   'Si el dump legacy cambió los ids de Deposito/cajas, recomputar los uuid5 '
                   'y actualizar los pares de este fragmento.';
  END IF;

  -- Vinculado, pero a OTRA caja que la esperada: no es error (puede ser una
  -- decisión posterior del club), pero tiene que verse.
  WITH pares AS (
    SELECT (v_pares[i][1])::uuid AS dep_id, (v_pares[i][2])::uuid AS caja_id, v_pares[i][3] AS nombre
      FROM generate_subscripts(v_pares, 1) AS i
  )
  SELECT string_agg(format('%s -> %s (se esperaba la caja del par)', p.nombre, cc.nombre),
                    '; ' ORDER BY p.nombre)
    INTO v_desviados
    FROM pares p
    JOIN depositos d ON d.id = p.dep_id
    JOIN cajas    cc ON cc.id = d.caja_id
   WHERE d.caja_id <> p.caja_id;

  IF v_desviados IS NOT NULL THEN
    RAISE WARNING 'Fragmento 4: puntos de venta apuntando a otra caja: %', v_desviados;
  END IF;

  -- Censo completo de puntos de venta, con nombres. Esperado tras migrate.py:
  -- 3 en total, 2 con caja, 1 sin caja (Tiro Practico, documentado arriba).
  SELECT count(*) FILTER (WHERE d.caja_id IS NOT NULL),
         count(*) FILTER (WHERE d.caja_id IS NULL),
         string_agg(format('%s -> %s', d.nombre, c.nombre), ', ' ORDER BY d.nombre)
           FILTER (WHERE d.caja_id IS NOT NULL),
         string_agg(d.nombre, ', ' ORDER BY d.nombre) FILTER (WHERE d.caja_id IS NULL)
    INTO v_con_caja, v_sin_caja, v_nom_con, v_nom_sin
    FROM depositos d
    LEFT JOIN cajas c ON c.id = d.caja_id
   WHERE d.tipo = 'punto_venta';

  RAISE NOTICE 'Fragmento 4: puntos de venta CON caja (%): %', v_con_caja, coalesce(v_nom_con, '-');
  RAISE NOTICE 'Fragmento 4: puntos de venta SIN caja (%): %', v_sin_caja, coalesce(v_nom_sin, '-');

  IF v_con_caja = 2 AND v_sin_caja = 1 AND v_nom_sin = 'Tiro Practico' THEN
    INSERT INTO _reseed_resumen VALUES (4, 'depositos.caja_id (PdV -> tesorería)', 'OK',
      format('2 con caja (%s); 1 sin caja: Tiro Practico (esperado, el legacy no tiene esa caja)', v_nom_con));
  ELSE
    RAISE WARNING 'Fragmento 4: el censo de puntos de venta no es el esperado (2 con caja / 1 sin caja: Tiro Practico)';
    INSERT INTO _reseed_resumen VALUES (4, 'depositos.caja_id (PdV -> tesorería)', 'REVISAR',
      format('Los 2 pares del mapa están vinculados. Censo: %s con caja (%s); %s sin caja (%s). Esperado: 2 / 1 (Tiro Practico)',
             v_con_caja, coalesce(v_nom_con, '-'), v_sin_caja, coalesce(v_nom_sin, '-')));
  END IF;
END;
$frag4$;


-- =============================================================================
-- FRAGMENTO 5 — Recargo a no socios: SÓLO REPORTA, salvo opt-in explícito
--
-- ORIGEN : supabase/migrations/20260812000002_items_ventas_recargo_no_socio.sql
-- QUÉ HACÍA: UPDATE items_ventas SET precio_no_socio = round(precio * 1.2, 2)
--          donde ambas tarifas eran iguales (158 filas de 210 en producción).
-- QUÉ PASA AHORA: migrate.py repone `ValorNoSocio` tal cual está en el dump
--          (migrate.py:365-366), que casi nunca se cargó distinto. El recargo
--          se pierde y el toggle Socio/No Socio del POS vuelve a no mover el
--          importe del carrito.
--
-- POR QUÉ ESTE NO SE APLICA SOLO
-- ------------------------------
-- Es plata, y un UPDATE masivo a ciegas es exactamente lo que no hay que hacer:
--   * ~165 ítems tienen las dos tarifas iguales — algunos porque el club nunca
--     cargó la segunda, otros porque de verdad valen lo mismo.
--   * 19 ítems están en $0. En el legacy, ValorSocio = 0 significaba "esto no
--     se le vende a socios" (Derecho de línea, ESTACIONAMIENTO, CHALET);
--     multiplicar cero no aporta nada.
--   * parte de la distinción socio/no socio está modelada como ÍTEMS SEPARADOS
--     ('Permiso de Caza - Socio' $330 / '- No Socio' $400). Aplicarles el
--     recargo lo cobra DOS VECES: una en el nombre y otra en la columna.
-- Por eso: por defecto este bloque SÓLO REPORTA. No falla, no escribe.
--
-- LOS TRES GUARDS DEL WHERE son los del archivo origen y se respetan tal cual:
--     precio_no_socio = precio  AND  precio > 0  AND  activo  AND  nombre !~* 'socio'
-- El `!~* 'socio'` es deliberadamente inclusivo y sobre-excluye (LLAVE SALA DE
-- SOCIOS cae ahí sin ser un par): se prefiere no tocar de más.
--
-- PARA APLICARLO DE VERDAD — OPT-IN EXPLÍCITO
-- -------------------------------------------
-- Mismo patrón que restore_datos_erp.sql usa para los huérfanos de app móvil:
--
--     PGOPTIONS='-c migracion.aplicar_recargo_no_socio=on' \
--       psql "$CONN" -v ON_ERROR_STOP=1 -f migration/reseed_post_migracion.sql
--
--   o, dentro de una sesión psql, antes de \i:
--
--     SET migracion.aplicar_recargo_no_socio = 'on';
--
-- El flujo previsto es correrlo una vez SIN el flag, leer el reporte, y recién
-- entonces decidir. La alternativa —y probablemente la mejor si el club quiere
-- revisar ítem por ítem— es no usar este bloque y hacerlo desde la pantalla
-- Seguridad -> Configuración, que llama a recalcular_precios_no_socio() con
-- preview (20260812000003_configuracion_sistema.sql:199). OJO: esa RPC tiene
-- alcance MÁS AMPLIO (todas las filas, sin las tres excepciones de arriba).
--
-- El porcentaje sale de `configuracion.recargo_no_socio_pct` (el VentaDefault=20
-- del legacy), no del 1.2 hardcodeado del archivo origen: si el club lo cambió,
-- manda el valor configurado.
-- =============================================================================

DO $frag5$
DECLARE
  v_flag       text := lower(coalesce(current_setting('migracion.aplicar_recargo_no_socio', true), ''));
  v_aplicar    boolean := v_flag IN ('on', 'true', '1', 'yes', 'si', 'sí');
  v_pct        numeric := 20;
  v_factor     numeric;
  v_candidatos int;
  v_delta      numeric;
  v_cero       int;
  v_inactivos  int;
  v_socio      int;
  v_difiere    int;
  v_afectadas  int;
  v_cfg_at     text;
  v_cfg_items  int;
  r            record;
  v_i          int := 0;
BEGIN
  -- `configuracion` NO se trunca (no está en la lista de las 22), así que
  -- sobrevive intacta a la re-migración. El to_regclass es por si este archivo
  -- se corre contra una base anterior a 20260812000003.
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    SELECT c.recargo_no_socio_pct,
           to_char(c.recargo_aplicado_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
                   'DD/MM/YYYY HH24:MI'),
           c.recargo_aplicado_items
      INTO v_pct, v_cfg_at, v_cfg_items
      FROM configuracion c WHERE c.id = 1;
    v_pct := coalesce(v_pct, 20);
  END IF;

  v_factor := 1 + v_pct / 100;

  SELECT count(*), coalesce(sum(round(iv.precio * v_factor, 2) - iv.precio_no_socio), 0)
    INTO v_candidatos, v_delta
    FROM items_ventas iv
   WHERE iv.precio_no_socio = iv.precio
     AND iv.precio > 0
     AND iv.activo
     AND iv.nombre !~* 'socio';

  -- Lo que el reporte NO va a tocar, y por qué. Se muestra para que el operador
  -- vea el recorte completo, no sólo la parte que se movería.
  SELECT count(*) FILTER (WHERE iv.precio <= 0),
         count(*) FILTER (WHERE NOT iv.activo),
         count(*) FILTER (WHERE iv.nombre ~* 'socio'),
         count(*) FILTER (WHERE iv.precio_no_socio <> iv.precio)
    INTO v_cero, v_inactivos, v_socio, v_difiere
    FROM items_ventas iv;

  RAISE NOTICE '--------------------------------------------------------------------';
  RAISE NOTICE 'Fragmento 5 — recargo a no socios (pct configurado: %)', v_pct;
  RAISE NOTICE '  candidatos (misma tarifa, activo, precio>0, nombre sin "socio"): %', v_candidatos;
  RAISE NOTICE '  NO se tocan: % con precio<=0 | % inactivos | % con "socio" en el nombre | % con tarifa ya diferenciada',
    v_cero, v_inactivos, v_socio, v_difiere;
  IF v_cfg_at IS NOT NULL THEN
    RAISE NOTICE '  OJO: configuracion dice que el recargo se aplicó el % a % ítems.', v_cfg_at, v_cfg_items;
    RAISE NOTICE '       Esa tabla NO se trunca: está afirmando un trabajo que la re-migración deshizo.';
    RAISE NOTICE '       Blanquearlo con: UPDATE configuracion SET recargo_aplicado_at=NULL,';
    RAISE NOTICE '       recargo_aplicado_por=NULL, recargo_aplicado_items=NULL WHERE id=1;';
  END IF;

  IF v_candidatos > 0 THEN
    -- El nombre va ÚLTIMO y sin recortar: en un reporte de plata, un nombre
    -- truncado esconde justo la diferencia entre dos ítems parecidos.
    RAISE NOTICE '  Muestra (hasta 40, de mayor a menor precio) — actual -> propuesto | nombre:';
    FOR r IN
      SELECT iv.nombre, iv.precio, iv.precio_no_socio AS actual,
             round(iv.precio * v_factor, 2) AS propuesto
        FROM items_ventas iv
       WHERE iv.precio_no_socio = iv.precio
         AND iv.precio > 0
         AND iv.activo
         AND iv.nombre !~* 'socio'
       ORDER BY iv.precio DESC, iv.nombre
       LIMIT 40
    LOOP
      v_i := v_i + 1;
      RAISE NOTICE '    % -> % | %', lpad(r.actual::text, 12), lpad(r.propuesto::text, 12), r.nombre;
    END LOOP;
    IF v_candidatos > v_i THEN
      RAISE NOTICE '    ... y % más. Lista completa:', v_candidatos - v_i;
      RAISE NOTICE '    SELECT nombre, precio, precio_no_socio, round(precio * %, 2) AS propuesto', v_factor;
      RAISE NOTICE '      FROM items_ventas WHERE precio_no_socio = precio AND precio > 0';
      RAISE NOTICE '       AND activo AND nombre !~* ''socio'' ORDER BY precio DESC;';
    END IF;
  END IF;

  IF NOT v_aplicar THEN
    RAISE NOTICE '  MODO REPORTE (no se escribió nada). Para aplicar:';
    RAISE NOTICE '    PGOPTIONS=''-c migracion.aplicar_recargo_no_socio=on'' psql ... -f este_archivo';
    RAISE NOTICE '--------------------------------------------------------------------';
    INSERT INTO _reseed_resumen VALUES (5, 'recargo no socio (items_ventas)', 'REPORTE',
      format('%s ítems serían afectados (+%s en total de tarifa de no socio). NO se aplicó: falta el opt-in migracion.aplicar_recargo_no_socio=on',
             v_candidatos, v_delta));
    RETURN;
  END IF;

  UPDATE items_ventas iv
     SET precio_no_socio = round(iv.precio * v_factor, 2)
   WHERE iv.precio_no_socio = iv.precio
     AND iv.precio > 0
     AND iv.activo
     AND iv.nombre !~* 'socio';
  GET DIAGNOSTICS v_afectadas = ROW_COUNT;

  RAISE NOTICE '  APLICADO (opt-in presente): % ítems actualizados', v_afectadas;
  RAISE NOTICE '--------------------------------------------------------------------';

  IF v_afectadas <> v_candidatos THEN
    RAISE EXCEPTION 'Fragmento 5: se contaron % candidatos y el UPDATE tocó % filas', v_candidatos, v_afectadas;
  END IF;

  -- %% para que format() emita un '%' literal.
  INSERT INTO _reseed_resumen VALUES (5, 'recargo no socio (items_ventas)', 'OK',
    format('APLICADO con opt-in: %s ítems, precio de no socio = precio + %s%%', v_afectadas, v_pct));
END;
$frag5$;


-- =============================================================================
-- RESUMEN
-- =============================================================================

DO $resumen$
DECLARE
  r record;
  v_revisar int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE ' reseed_post_migracion — resumen';
  RAISE NOTICE '====================================================================';
  FOR r IN SELECT * FROM _reseed_resumen ORDER BY orden LOOP
    -- rpad sólo sobre `estado`, que tiene vocabulario fijo y corto. El nombre
    -- del fragmento va sin recortar: alinear no vale perder texto.
    RAISE NOTICE '[%] % — %', rpad(r.estado, 11), r.fragmento, r.detalle;
  END LOOP;

  SELECT count(*) INTO v_revisar FROM _reseed_resumen WHERE estado = 'REVISAR';
  RAISE NOTICE '--------------------------------------------------------------------';
  IF v_revisar > 0 THEN
    RAISE NOTICE ' % fragmento(s) en REVISAR: los invariantes duros pasaron, pero hay', v_revisar;
    RAISE NOTICE ' desvíos respecto del estado esperado. Mirar los WARNING de arriba.';
  ELSE
    RAISE NOTICE ' Todos los invariantes duros repuestos y verificados.';
  END IF;
  RAISE NOTICE ' Recordar: el Fragmento 5 (recargo a no socios) NO se aplica solo.';
  RAISE NOTICE ' Siguiente paso del pipeline: migration/restore_datos_erp.sql';
  RAISE NOTICE '====================================================================';
END;
$resumen$;

COMMIT;
