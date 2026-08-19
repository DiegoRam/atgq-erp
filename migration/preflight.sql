-- ============================================================================
-- PREFLIGHT DE RE-MIGRACIÓN — ATGQ ERP
--
-- Reporte 100% READ-ONLY contra la base de PRODUCCIÓN. No escribe nada:
-- no hay INSERT / UPDATE / DELETE / TRUNCATE / ALTER / CREATE en este archivo,
-- ni siquiera tablas temporales. Corre dentro de una transacción declarada
-- READ ONLY y termina en ROLLBACK, así que el motor mismo rechazaría cualquier
-- escritura que se colara.
--
-- Uso:
--     psql "$PG_DSN" -f migration/preflight.sql
--     psql "$PG_DSN" -f migration/preflight.sql > preflight_$(date +%F).txt
--
-- Para qué existe
-- ---------------
-- El 2026-07-24 se migró el sistema legacy a producción. Desde entonces el ERP
-- ESTUVO EN USO: se cargaron ventas por el POS nuevo, movimientos de tesorería,
-- y socios activaron la app móvil. El plan de re-migración hace TRUNCATE de 22
-- tablas y vuelve a correr migrate.py sobre un dump legacy más nuevo.
-- Todo lo que nació en el ERP y no existe en el legacy SE PIERDE.
--
-- Este reporte es el gate humano que decide si eso es aceptable. No es
-- informativo: sin una aprobación explícita del dueño del sistema sobre lo que
-- figura acá, el plan no sigue.
--
-- Cómo se distingue lo que nació en el ERP de lo migrado
-- -----------------------------------------------------
-- migration/migrate.py genera los ids con uuid5 determinista (nid(), línea 36).
-- La app, en cambio, deja el DEFAULT gen_random_uuid(), que produce UUID v4.
-- El carácter 15 del UUID en texto es el nibble de versión:
--     ...-XXXX-4xxx-...  -> v4 -> NACIÓ EN EL ERP NUEVO (se pierde)
--     ...-XXXX-5xxx-...  -> v5 -> vino del legacy vía migrate.py (se recupera)
-- La sección 0 verifica ese supuesto antes de que el resto lo dé por cierto.
--
-- Si el script aborta con ERROR, el reporte NO ES VÁLIDO: hay que arreglarlo y
-- volver a correrlo. No se decide con un preflight parcial.
-- ============================================================================

\encoding UTF8
\pset pager off
\pset border 2
\pset null '(nulo)'
\timing off
\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;


\echo ''
\echo '################################################################################'
\echo '#                                                                              #'
\echo '#   PREFLIGHT DE RE-MIGRACIÓN — ATGQ ERP                                       #'
\echo '#   Qué se pierde si se truncan 22 tablas y se re-migra el legacy encima       #'
\echo '#                                                                              #'
\echo '################################################################################'
\echo ''
\echo '--- CONTEXTO DE LA SESIÓN --------------------------------------------------'
\echo ''
\echo 'ATENCIÓN: si el usuario que corre esto NO es dueño de las tablas ni tiene'
\echo 'BYPASSRLS, las políticas de RLS filtran los SELECT y TODOS los conteos de'
\echo 'este reporte salen de menos, sin ningún error. En ese caso el reporte miente'
\echo 'y no sirve como gate. Verificar la fila de abajo antes de seguir leyendo.'
\echo ''

SELECT current_user                                              AS usuario,
       current_database()                                        AS base,
       (SELECT rolsuper      FROM pg_roles WHERE rolname = current_user) AS es_superuser,
       (SELECT rolbypassrls  FROM pg_roles WHERE rolname = current_user) AS bypassrls,
       (SELECT tableowner    FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'socios')   AS dueno_de_socios,
       pg_is_in_recovery()                                       AS es_replica_lectura,
       to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires',
               'DD/MM/YYYY HH24:MI:SS')                          AS momento_local;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 0. VERIFICACIÓN DEL SUPUESTO: LA VERSIÓN DEL UUID DISTINGUE EL ORIGEN'
\echo '================================================================================'
\echo ''
\echo 'Desglose real del carácter 15 del UUID (el nibble de versión) en cinco tablas'
\echo 'conocidas. Lo esperado es ver SÓLO 4 y 5:'
\echo '    5 = insertado por migrate.py (uuid5 determinista)'
\echo '    4 = insertado por la app (DEFAULT gen_random_uuid)'
\echo 'Si aparece cualquier otro carácter, el supuesto no se sostiene tal cual y las'
\echo 'secciones siguientes hay que leerlas con esa salvedad — por eso se muestra'
\echo 'agrupado y no filtrado.'
\echo ''
\echo '(Una tabla vacía no aporta ninguna fila acá. Si falta alguna de las cinco, es'
\echo 'porque no tiene registros — la sección 1.A lo confirma con el total en 0.)'
\echo ''

SELECT tabla, version_uuid, filas
FROM (
  SELECT 'socios'::text             AS tabla, substring(id::text FROM 15 FOR 1) AS version_uuid, count(*) AS filas FROM socios             GROUP BY 1, 2
  UNION ALL
  SELECT 'cuotas',                  substring(id::text FROM 15 FOR 1), count(*) FROM cuotas             GROUP BY 1, 2
  UNION ALL
  SELECT 'ventas',                  substring(id::text FROM 15 FOR 1), count(*) FROM ventas             GROUP BY 1, 2
  UNION ALL
  SELECT 'movimientos_fondos',      substring(id::text FROM 15 FOR 1), count(*) FROM movimientos_fondos GROUP BY 1, 2
  UNION ALL
  SELECT 'items_ventas',            substring(id::text FROM 15 FOR 1), count(*) FROM items_ventas       GROUP BY 1, 2
) t
ORDER BY tabla, version_uuid;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 1.A  FILAS NACIDAS EN EL ERP NUEVO vs MIGRADAS DEL LEGACY'
\echo '      (las 22 tablas que el plan trunca)'
\echo '================================================================================'
\echo ''
\echo 'Cómo leerla:'
\echo '  del_legacy    = filas v5. Las vuelve a crear migrate.py. NO se pierden.'
\echo '  nacidas_erp   = filas v4. NO existen en el dump legacy. SE PIERDEN.'
\echo '  otra_version  = ni v4 ni v5. Si no es 0, revisar la sección 0.'
\echo ''
\echo 'La columna "alerta" marca:'
\echo '  PERDIDA CRITICA -> tabla TRANSACCIONAL con filas nacidas en el ERP. Es'
\echo '                     actividad real del club (plata, stock, cuotas, turnos)'
\echo '                     que no tiene de dónde volver. Ver el detalle en 1.B.'
\echo '  revisar         -> tabla de catálogo/maestro con filas nuevas. Se pueden'
\echo '                     rehacer a mano, pero hay que saber cuáles son (1.C).'
\echo ''

WITH conteos AS (
  SELECT 'cuotas'::text AS tabla, true AS transaccional, count(*)::bigint AS total,
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5')::bigint AS del_legacy,
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4')::bigint AS nacidas_erp,
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))::bigint AS otra_version
    FROM cuotas
  UNION ALL SELECT 'ventas', true, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM ventas
  UNION ALL SELECT 'ventas_items', true, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM ventas_items
  UNION ALL SELECT 'movimientos_fondos', true, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM movimientos_fondos
  UNION ALL SELECT 'movimientos_stock', true, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM movimientos_stock
  UNION ALL SELECT 'turnos', true, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM turnos
  UNION ALL SELECT 'socios', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM socios
  UNION ALL SELECT 'socios_actividades', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM socios_actividades
  UNION ALL SELECT 'stock_inventario', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM stock_inventario
  UNION ALL SELECT 'grupos_familiares', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM grupos_familiares
  UNION ALL SELECT 'clientes', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM clientes
  UNION ALL SELECT 'items_ventas', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM items_ventas
  UNION ALL SELECT 'stock_items', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM stock_items
  UNION ALL SELECT 'depositos', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM depositos
  UNION ALL SELECT 'instalaciones', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM instalaciones
  UNION ALL SELECT 'actividades', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM actividades
  UNION ALL SELECT 'actividades_extras', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM actividades_extras
  UNION ALL SELECT 'cajas', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM cajas
  UNION ALL SELECT 'categorias_movimientos', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM categorias_movimientos
  UNION ALL SELECT 'categorias_sociales', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM categorias_sociales
  UNION ALL SELECT 'metodos_cobranza', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM metodos_cobranza
  UNION ALL SELECT 'tipos_cuotas', false, count(*),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '5'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) = '4'),
         count(*) FILTER (WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5')) FROM tipos_cuotas
)
SELECT CASE WHEN nacidas_erp > 0 AND transaccional THEN 'PERDIDA CRITICA'
            WHEN nacidas_erp > 0                   THEN 'revisar'
            ELSE '' END                             AS alerta,
       CASE WHEN transaccional THEN 'transaccional' ELSE 'maestro' END AS clase,
       tabla, total, del_legacy, nacidas_erp, otra_version
  FROM conteos
 ORDER BY (nacidas_erp > 0) DESC, transaccional DESC, nacidas_erp DESC, tabla;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 1.B  DETALLE DE LO QUE NACIÓ EN EL ERP: CUÁNDO Y POR CUÁNTA PLATA'
\echo '================================================================================'
\echo ''
\echo 'Sólo aparecen las tablas con al menos una fila v4. Cada fila del reporte es'
\echo 'una tabla vista por una columna de fecha (algunas tienen dos: la fecha del'
\echo 'negocio y la de creación del registro, que pueden no coincidir).'
\echo 'monto_ars suma la columna de importe de esa tabla; unidades suma cantidades.'
\echo 'Si esta sección sale vacía, nada nació en el ERP y el truncate no pierde nada.'
\echo ''

WITH det AS (
  SELECT 'ventas'::text AS tabla, 'fecha'::text AS col, count(*)::bigint AS filas,
         min(fecha)::timestamptz AS desde, max(fecha)::timestamptz AS hasta,
         round(sum(total), 2) AS monto_ars, NULL::bigint AS unidades
    FROM ventas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'ventas', 'created_at', count(*), min(created_at), max(created_at), round(sum(total),2), NULL::bigint
    FROM ventas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'ventas_items', 'created_at', count(*), min(created_at), max(created_at),
         round(sum(subtotal),2), sum(cantidad)::bigint
    FROM ventas_items WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'movimientos_fondos', 'fecha', count(*), min(fecha), max(fecha), round(sum(monto),2), NULL::bigint
    FROM movimientos_fondos WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'movimientos_fondos', 'created_at', count(*), min(created_at), max(created_at), round(sum(monto),2), NULL::bigint
    FROM movimientos_fondos WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'movimientos_stock', 'created_at', count(*), min(created_at), max(created_at),
         NULL::numeric, sum(cantidad)::bigint
    FROM movimientos_stock WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'cuotas', 'periodo', count(*), min(periodo)::timestamptz, max(periodo)::timestamptz,
         round(sum(monto),2), NULL::bigint
    FROM cuotas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'cuotas', 'created_at', count(*), min(created_at), max(created_at), round(sum(monto),2), NULL::bigint
    FROM cuotas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'turnos', 'fecha_turno', count(*), min(fecha_turno)::timestamptz, max(fecha_turno)::timestamptz,
         NULL::numeric, NULL::bigint
    FROM turnos WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'socios', 'fecha_alta', count(*), min(fecha_alta)::timestamptz, max(fecha_alta)::timestamptz,
         NULL::numeric, NULL::bigint
    FROM socios WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'socios_actividades', 'fecha_inscripcion', count(*),
         min(fecha_inscripcion)::timestamptz, max(fecha_inscripcion)::timestamptz, NULL::numeric, NULL::bigint
    FROM socios_actividades WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  -- stock_inventario no tiene created_at: sólo updated_at, que se mueve con cada
  -- venta. Para saber el origen de la fila vale la versión del UUID, no la fecha.
  SELECT 'stock_inventario', 'updated_at', count(*), min(updated_at), max(updated_at),
         NULL::numeric, sum(cantidad)::bigint
    FROM stock_inventario WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'grupos_familiares', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM grupos_familiares WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'clientes', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM clientes WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'items_ventas', 'created_at', count(*), min(created_at), max(created_at),
         round(sum(precio),2), NULL::bigint
    FROM items_ventas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'stock_items', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM stock_items WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'depositos', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM depositos WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'instalaciones', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM instalaciones WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'actividades', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM actividades WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'actividades_extras', 'created_at', count(*), min(created_at), max(created_at),
         round(sum(monto),2), NULL::bigint
    FROM actividades_extras WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'cajas', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM cajas WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'categorias_movimientos', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM categorias_movimientos WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'categorias_sociales', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM categorias_sociales WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'metodos_cobranza', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM metodos_cobranza WHERE substring(id::text FROM 15 FOR 1) = '4'
  UNION ALL
  SELECT 'tipos_cuotas', 'created_at', count(*), min(created_at), max(created_at), NULL::numeric, NULL::bigint
    FROM tipos_cuotas WHERE substring(id::text FROM 15 FOR 1) = '4'
)
SELECT tabla, col AS columna_fecha, filas,
       to_char(desde AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS desde,
       to_char(hasta AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') AS hasta,
       monto_ars, unidades
  FROM det
 WHERE filas > 0
 ORDER BY tabla, col;


\echo ''
\echo '--- 1.B.bis  Ventas nacidas en el ERP: estado y punto de venta ----------------'
\echo ''
\echo 'Desglose de las ventas v4 (las que se pierden) por punto de venta y por si'
\echo 'están anuladas. Una venta anulada ya generó su contra-movimiento de fondos.'
\echo ''

SELECT coalesce(d.nombre, '(sin punto de venta)') AS punto_venta,
       v.anulada,
       count(*)::bigint                           AS ventas,
       round(sum(v.total), 2)                     AS monto_ars
  FROM ventas v
  LEFT JOIN depositos d ON d.id = v.punto_venta_id
 WHERE substring(v.id::text FROM 15 FOR 1) = '4'
 GROUP BY 1, 2
 ORDER BY 1, 2;


\echo ''
\echo '--- 1.C  Catálogos nacidos en el ERP: los nombres, uno por uno ----------------'
\echo ''
\echo 'Estas filas se pueden rehacer a mano DESPUÉS de la re-migración, pero sólo si'
\echo 'alguien anotó cuáles eran. Esta es la lista para anotar. (Máximo 50 por tabla;'
\echo 'si alguna llega a 50, hay más y la 1.A dice cuántas.)'
\echo ''

SELECT tabla, nombre, detalle
FROM (
  SELECT 'items_ventas'::text AS tabla, nombre,
         'precio ' || precio::text || ' / activo ' || activo::text AS detalle
    FROM items_ventas WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) a
UNION ALL SELECT * FROM (
  SELECT 'stock_items'::text, nombre, 'unidad ' || unidad || ' / activo ' || activo::text
    FROM stock_items WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) b
UNION ALL SELECT * FROM (
  SELECT 'depositos'::text, nombre, 'tipo ' || tipo
    FROM depositos WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) c
UNION ALL SELECT * FROM (
  SELECT 'cajas'::text, nombre, 'saldo_inicial ' || saldo_inicial::text
    FROM cajas WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) d
UNION ALL SELECT * FROM (
  SELECT 'categorias_movimientos'::text, nombre, 'tipo ' || tipo
    FROM categorias_movimientos WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) e
UNION ALL SELECT * FROM (
  SELECT 'categorias_sociales'::text, nombre,
         'activa ' || activa::text || ' / voto ' || habilita_voto::text
    FROM categorias_sociales WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) f
UNION ALL SELECT * FROM (
  SELECT 'metodos_cobranza'::text, nombre, 'activo ' || activo::text
    FROM metodos_cobranza WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) g
UNION ALL SELECT * FROM (
  SELECT 'tipos_cuotas'::text, nombre,
         'activo ' || activo::text || ' / afecta_padron ' || afecta_padron::text
    FROM tipos_cuotas WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) h
UNION ALL SELECT * FROM (
  SELECT 'instalaciones'::text, nombre, 'activa ' || activa::text
    FROM instalaciones WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) i
UNION ALL SELECT * FROM (
  SELECT 'actividades'::text, nombre, 'activa ' || activa::text
    FROM actividades WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY nombre LIMIT 50
) j
UNION ALL SELECT * FROM (
  SELECT 'clientes'::text, apellido || ', ' || nombre, coalesce('DNI ' || dni, '(sin DNI)')
    FROM clientes WHERE substring(id::text FROM 15 FOR 1) = '4' ORDER BY apellido, nombre LIMIT 50
) k
ORDER BY 1, 2;


\echo ''
\echo '--- 1.D  Socios dados de alta en el ERP (no están en el legacy) ---------------'
\echo ''
\echo 'Socios cuya alta se cargó por el ERP nuevo. Tras el truncate + re-migración no'
\echo 'existen, salvo que también los hayan cargado en el sistema legacy. Cotejar'
\echo 'estos nro_socio contra el dump del 2026-08-17 antes de aprobar.'
\echo 'Se muestran hasta 50; el total exacto está en 1.A.'
\echo ''

SELECT s.nro_socio, s.apellido, s.nombre, s.dni,
       cs.nombre                              AS categoria,
       to_char(s.fecha_alta, 'DD/MM/YYYY')    AS fecha_alta,
       (SELECT count(*) FROM cuotas c WHERE c.socio_id = s.id)::bigint AS cuotas,
       (SELECT count(*) FROM ventas v WHERE v.socio_id = s.id)::bigint AS ventas
  FROM socios s
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
 WHERE substring(s.id::text FROM 15 FOR 1) = '4'
 ORDER BY s.nro_socio
 LIMIT 50;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 2. VÍNCULOS DE LA APP MÓVIL (socios_usuarios / socios_invitaciones)'
\echo '================================================================================'
\echo ''
\echo 'NOTA FIJA — ESTAS DOS TABLAS NO ESTÁN EN LA LISTA DE TRUNCATE, Y SE VACÍAN'
\echo 'IGUAL. TRUNCATE socios CASCADE las arrastra, aun cuando socios_usuarios.socio_id'
\echo 'está declarado ON DELETE RESTRICT (RESTRICT frena un DELETE, no un TRUNCATE'
\echo 'CASCADE). Verificado empíricamente contra una base real.'
\echo ''
\echo 'Y NO EXISTEN EN EL LEGACY: son el vínculo entre auth.users y socios que se creó'
\echo 'en el ERP nuevo. No hay forma de reconstruirlos desde el dump. Las cuentas de'
\echo 'auth.users sobreviven (auth no se trunca), pero quedan huérfanas: el socio abre'
\echo 'la app, está logueado, y no ve nada. Hace falta re-emitir invitación y que cada'
\echo 'socio la vuelva a canjear — o un mecanismo de stash/restore probado ANTES.'
\echo ''

SELECT 'socios_usuarios: vínculos ACTIVOS'::text AS estado,
       count(*)::bigint AS filas
  FROM socios_usuarios WHERE revocado_at IS NULL
UNION ALL
SELECT 'socios_usuarios: vínculos revocados', count(*)
  FROM socios_usuarios WHERE revocado_at IS NOT NULL
UNION ALL
SELECT 'socios_invitaciones: VIGENTES (sin usar, sin revocar, sin vencer)', count(*)
  FROM socios_invitaciones
 WHERE usado_at IS NULL AND revocada_at IS NULL AND expira_at > now()
UNION ALL
SELECT 'socios_invitaciones: usadas', count(*)
  FROM socios_invitaciones WHERE usado_at IS NOT NULL
UNION ALL
SELECT 'socios_invitaciones: revocadas', count(*)
  FROM socios_invitaciones WHERE revocada_at IS NOT NULL
UNION ALL
SELECT 'socios_invitaciones: expiradas sin usar', count(*)
  FROM socios_invitaciones
 WHERE usado_at IS NULL AND revocada_at IS NULL AND expira_at <= now();


\echo ''
\echo '--- 2.B  Socios con cuenta móvil ACTIVA: la lista para cotejar ----------------'
\echo ''
\echo 'No se puede calcular acá cuántos de estos socio_id van a dejar de existir tras'
\echo 'la re-migración: eso depende del dump nuevo, que esta base no conoce. Lo que sí'
\echo 'se puede hacer es exportar estos nro_socio y cotejarlos contra el dump del'
\echo '2026-08-17. La columna origen_socio ya adelanta un caso seguro: un socio que'
\echo 'NACIÓ EN EL ERP no está en el legacy, así que su vínculo se pierde sí o sí.'
\echo 'Se muestran los primeros 20 por nro_socio; el total está arriba en 2.'
\echo ''

SELECT s.nro_socio, s.apellido, s.nombre, s.dni,
       CASE substring(s.id::text FROM 15 FOR 1)
            WHEN '5' THEN 'legacy'
            WHEN '4' THEN 'NACIO EN EL ERP'
            ELSE 'otra version' END              AS origen_socio,
       to_char(su.vinculado_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
               'DD/MM/YYYY HH24:MI')             AS vinculado_at
  FROM socios_usuarios su
  JOIN socios s ON s.id = su.socio_id
 WHERE su.revocado_at IS NULL
 ORDER BY s.nro_socio
 LIMIT 20;


\echo ''
\echo '--- 2.C  Invitaciones VIGENTES (códigos en la mano de un socio, sin canjear) --'
\echo ''
\echo 'Estos códigos dejan de servir después del truncate: la invitación desaparece y'
\echo 'el socio se queda con un papel inútil. Se muestran los primeros 20.'
\echo ''

SELECT s.nro_socio, s.apellido, s.nombre,
       i.codigo_prefijo || '...'                 AS codigo,
       to_char(i.expira_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
               'DD/MM/YYYY HH24:MI')             AS expira_at
  FROM socios_invitaciones i
  JOIN socios s ON s.id = i.socio_id
 WHERE i.usado_at IS NULL AND i.revocada_at IS NULL AND i.expira_at > now()
 ORDER BY s.nro_socio
 LIMIT 20;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 3. INVARIANTES QUE EL TRUNCATE REVIERTE'
\echo '================================================================================'
\echo ''
\echo 'Estos son ajustes de configuración que hoy están aplicados sobre las tablas que'
\echo 'se truncan. Al vaciarlas y re-migrar, TODOS vuelven al estado que deje el dump'
\echo 'legacy + las migraciones. Lo que figure acá hay que saber re-aplicarlo después,'
\echo 'y la lista de abajo es el "antes" contra el cual comparar.'
\echo ''

WITH inv AS (
  SELECT 1 AS n,
         'categorias_sociales con habilita_voto = true'::text AS invariante,
         '8'::text AS esperado,
         (SELECT count(*)::text FROM categorias_sociales WHERE habilita_voto) AS encontrado,
         true AS comparable
  UNION ALL SELECT 2, 'tipos_cuotas con afecta_padron = true', '1',
         (SELECT count(*)::text FROM tipos_cuotas WHERE afecta_padron), true
  UNION ALL SELECT 3, 'depositos tipo=punto_venta SIN caja_id (rompen ventas->tesoreria)', '0',
         (SELECT count(*)::text FROM depositos WHERE tipo = 'punto_venta' AND caja_id IS NULL), true
  UNION ALL SELECT 4, 'categorias_movimientos (Ventas, ingreso) — la exige registrar_venta', '1',
         (SELECT count(*)::text FROM categorias_movimientos WHERE nombre = 'Ventas' AND tipo = 'ingreso'), true
  UNION ALL SELECT 5, 'categorias_movimientos (Anulación de Ventas, egreso) — la exige anular_venta', '1',
         (SELECT count(*)::text FROM categorias_movimientos
           WHERE nombre = 'Anulación de Ventas' AND tipo = 'egreso'), true
  UNION ALL SELECT 6, 'configuracion: existe la fila id = 1', '1',
         (SELECT count(*)::text FROM configuracion WHERE id = 1), true
  UNION ALL SELECT 7, 'categorias_sociales con cuenta_como_activo = false (BAJA e Inactivo)', '2',
         (SELECT count(*)::text FROM categorias_sociales WHERE NOT cuenta_como_activo), true
  UNION ALL SELECT 8, 'depositos tipo=punto_venta (total)', 'revisar',
         (SELECT count(*)::text FROM depositos WHERE tipo = 'punto_venta'), false
  UNION ALL SELECT 9, 'socios activos (fecha_baja NULL y categoria cuenta_como_activo)', 'revisar',
         (SELECT count(*)::text FROM socios s JOIN categorias_sociales cs ON cs.id = s.categoria_id
           WHERE s.fecha_baja IS NULL AND cs.cuenta_como_activo), false
  UNION ALL SELECT 10, 'cuotas impagas (todas)', 'revisar',
         (SELECT count(*)::text FROM cuotas WHERE NOT pagada), false
  UNION ALL SELECT 11, 'cuotas impagas de tipo afecta_padron (cuota social)', 'revisar',
         (SELECT count(*)::text FROM cuotas c JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
           WHERE NOT c.pagada AND tc.afecta_padron), false
)
SELECT invariante, esperado, encontrado,
       CASE WHEN NOT comparable            THEN 'anotar el numero'
            WHEN esperado = encontrado     THEN 'OK'
            ELSE '>>> DESVIO' END AS estado
  FROM inv
 ORDER BY n;

\echo ''
\echo 'NOTA SOBRE EL INVARIANTE 1 (habilita_voto): el valor esperado 8 es el que fijó'
\echo 'el club el 2026-08-17. Si acá dice 6, es un DESVÍO YA CONOCIDO Y EXPLICADO, no'
\echo 'un error de este reporte: el seed de supabase/migrations/20260817000001_'
\echo 'padron_electoral.sql (líneas 41-46) tiene dos nombres que no matchean —'
\echo '"GRUPO FAMILIA" sin la R no matchea "Grupo Familiar", y'
\echo '"GRUPO FLIAR. MIEMBRO-VENTANILLA" no matchea "Grupo Fliar. Miembro  - Ventanilla"'
\echo '(tiene doble espacio). Las dos categorías quedan sin voto. El listado de abajo'
\echo 'muestra cuáles SÍ están marcadas, para ver exactamente cuáles faltan.'
\echo 'Tras la re-migración el problema se repite igual, porque el seed es el mismo.'
\echo ''
\echo '--- 3.A  Categorías con habilita_voto = true (las que hoy votan) --------------'
\echo ''

SELECT nombre, activa, cuenta_como_activo,
       (SELECT count(*) FROM socios s WHERE s.categoria_id = cs.id AND s.fecha_baja IS NULL)::bigint AS socios_sin_baja
  FROM categorias_sociales cs
 WHERE habilita_voto
 ORDER BY nombre;

\echo ''
\echo '--- 3.A.bis  Categorías con habilita_voto = false (las que NO votan) ----------'
\echo ''
\echo 'Mirar esta lista buscando alguna que debería estar votando. Ahí aparecen las'
\echo 'dos del typo del seed.'
\echo ''

SELECT nombre, activa, cuenta_como_activo,
       (SELECT count(*) FROM socios s WHERE s.categoria_id = cs.id AND s.fecha_baja IS NULL)::bigint AS socios_sin_baja
  FROM categorias_sociales cs
 WHERE NOT habilita_voto
 ORDER BY nombre;

\echo ''
\echo '--- 3.B  Tipos de cuota con afecta_padron = true ------------------------------'
\echo ''
\echo 'Es el tipo cuya deuda inhabilita a votar. Se espera exactamente uno: Cuota Social.'
\echo 'Si son cero, el criterio "al día" desaparece en silencio y el padrón habilita a'
\echo 'todo moroso.'
\echo ''

SELECT nombre, activo,
       (SELECT count(*) FROM cuotas c WHERE c.tipo_cuota_id = tc.id)::bigint AS cuotas_emitidas
  FROM tipos_cuotas tc
 WHERE afecta_padron
 ORDER BY nombre;

\echo ''
\echo '--- 3.C  Categorías con cuenta_como_activo = false ----------------------------'
\echo ''
\echo 'Es el predicado canónico de "socio activo" desde 20260806000001. Se esperan dos:'
\echo 'BAJA e Inactivo. El truncate lo revierte al DEFAULT true y hay que re-marcarlas,'
\echo 'o el dashboard, el padrón y los reportes cuentan de más.'
\echo ''

SELECT nombre, activa,
       (SELECT count(*) FROM socios s WHERE s.categoria_id = cs.id)::bigint AS socios
  FROM categorias_sociales cs
 WHERE NOT cuenta_como_activo
 ORDER BY nombre;

\echo ''
\echo '--- 3.D  Puntos de venta y su caja de tesorería -------------------------------'
\echo ''
\echo 'Sin caja vinculada, registrar_venta OMITE el movimiento de fondos EN SILENCIO:'
\echo 'la venta se registra y la plata nunca aparece en tesorería. El truncate borra'
\echo 'depositos y cajas, así que este vínculo se pierde y hay que re-aplicarlo (lo'
\echo 'hace 20260803000004_puntos_venta_ajuste_prod.sql, que empareja por nombre'
\echo 'idéntico entre depósito y caja — si los nombres del dump nuevo difieren, no'
\echo 'empareja nada y falla callado). Esta tabla es el "antes" a reproducir.'
\echo ''

SELECT d.nombre                                      AS punto_venta,
       d.activo,
       coalesce(c.nombre, '*** SIN CAJA ***')        AS caja_vinculada,
       c.activa                                      AS caja_activa,
       CASE substring(d.id::text FROM 15 FOR 1)
            WHEN '5' THEN 'legacy' WHEN '4' THEN 'ERP' ELSE 'otra' END AS origen
  FROM depositos d
  LEFT JOIN cajas c ON c.id = d.caja_id
 WHERE d.tipo = 'punto_venta'
 ORDER BY d.nombre;

\echo ''
\echo '--- 3.E  Categorías de movimiento que necesitan las ventas --------------------'
\echo ''
\echo 'registrar_venta y anular_venta hacen RAISE EXCEPTION si no encuentran estas dos'
\echo 'filas exactas (nombre y tipo). Sin ellas, el POS deja de vender.'
\echo ''

SELECT 'Ventas / ingreso'::text AS requerida,
       (SELECT count(*) FROM categorias_movimientos WHERE nombre = 'Ventas' AND tipo = 'ingreso')::bigint AS existe,
       (SELECT count(*) FROM movimientos_fondos m JOIN categorias_movimientos cm ON cm.id = m.categoria_id
         WHERE cm.nombre = 'Ventas' AND cm.tipo = 'ingreso')::bigint AS movimientos_que_la_usan
UNION ALL
SELECT 'Anulación de Ventas / egreso',
       (SELECT count(*) FROM categorias_movimientos WHERE nombre = 'Anulación de Ventas' AND tipo = 'egreso'),
       (SELECT count(*) FROM movimientos_fondos m JOIN categorias_movimientos cm ON cm.id = m.categoria_id
         WHERE cm.nombre = 'Anulación de Ventas' AND cm.tipo = 'egreso');

\echo ''
\echo '--- 3.F  Tarifas de items_ventas (socio vs no socio) --------------------------'
\echo ''
\echo 'items_ventas SE TRUNCA: los precios vuelven a los del dump legacy, que no tiene'
\echo 'el concepto de precio_no_socio. Todo ajuste de tarifa hecho en el ERP se pierde.'
\echo 'La fila "misma tarifa" es la que hay que mirar: si hoy hay muchos ítems con'
\echo 'precio_no_socio = precio, es señal de que el recargo nunca se aplicó a ellos o'
\echo 'de que la distinción socio/no socio está modelada como ítems separados.'
\echo ''

SELECT 'total de items' AS caso, count(*)::bigint AS items FROM items_ventas
UNION ALL SELECT 'activos', count(*) FROM items_ventas WHERE activo
UNION ALL SELECT 'tarifa diferenciada (precio_no_socio <> precio)', count(*)
  FROM items_ventas WHERE precio_no_socio IS NOT NULL AND precio_no_socio <> precio
UNION ALL SELECT 'misma tarifa, activos y con precio > 0 (precio_no_socio = precio)', count(*)
  FROM items_ventas WHERE precio_no_socio IS NOT NULL AND precio_no_socio = precio AND activo AND precio > 0
UNION ALL SELECT 'precio = 0', count(*) FROM items_ventas WHERE precio = 0
UNION ALL SELECT 'precio_no_socio NULL (sin tarifa de no socio cargada)', count(*)
  FROM items_ventas WHERE precio_no_socio IS NULL;

\echo ''
\echo '--- 3.G  configuracion (id = 1) — ESTA TABLA NO SE TRUNCA --------------------'
\echo ''
\echo 'configuracion sobrevive al truncate. Ojo con eso: si recargo_aplicado_at tiene'
\echo 'fecha, la pantalla de precios va a decir "el recargo ya se aplicó a N ítems"'
\echo 'MIENTRAS los ítems, recién re-migrados, volvieron al precio legacy sin recargo.'
\echo 'La configuración queda mintiendo sobre un trabajo que el truncate deshizo.'
\echo 'Después de re-migrar hay que volver a correr recalcular_precios_no_socio, o'
\echo 'blanquear a mano recargo_aplicado_*.'
\echo ''

SELECT recargo_no_socio_pct,
       to_char(recargo_aplicado_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
               'DD/MM/YYYY HH24:MI')  AS recargo_aplicado_at,
       recargo_aplicado_items,
       to_char(updated_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
               'DD/MM/YYYY HH24:MI')  AS updated_at
  FROM configuracion
 WHERE id = 1;


\echo ''
\echo ''
\echo '================================================================================'
\echo ' 4. NÚMERO "ANTES" DEL PADRÓN ELECTORAL'
\echo '================================================================================'
\echo ''
\echo 'IMPORTANTE — ESTO NO ES LA RPC get_padron(). ES UNA RÉPLICA DEL PREDICADO.'
\echo ''
\echo 'get_padron() es SECURITY DEFINER con un guard explícito:'
\echo '    IF NOT permiso_modulo_todos_los_roles(''socios'', ''leer'') THEN'
\echo '        RAISE EXCEPTION ''sin_permiso'';'
\echo 'Ese helper resuelve por auth.uid(), que en una sesión psql es NULL: la RPC'
\echo 'aborta sin importar con qué usuario de base se corra. Forzarlo (inventando un'
\echo 'JWT o un rol) daría un número que ya no es el que ve la pantalla.'
\echo ''
\echo 'Por eso acá se replica a mano el mismo predicado que get_padron aplica cuando'
\echo 'p_solo_habilitados = true: categoría con habilita_voto + fecha_nacimiento'
\echo 'presente + 18 años cumplidos + 1 año de antigüedad + sin cuota social impaga'
\echo 'anterior al período de corte (la del último período se tolera). El corte es'
\echo 'max(periodo) de cuota social emitida, acotado al mes en curso.'
\echo ''
\echo 'Si get_padron cambia y esta réplica no, los números se separan. Tratar este'
\echo 'valor como una referencia etiquetada, no como la salida de la RPC.'
\echo ''

SELECT to_regprocedure('public.get_padron(uuid,boolean)') IS NOT NULL AS existe_get_padron,
       to_regprocedure('public.padron_periodo_corte()')   IS NOT NULL AS existe_helper_corte;

\echo ''

WITH corte AS (
  SELECT max(c.periodo) AS periodo_corte
    FROM cuotas c
    JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
   WHERE tc.afecta_padron
     AND c.periodo <= date_trunc('month', current_date)::date
),
base AS (
  SELECT s.id, cs.habilita_voto, s.fecha_nacimiento,
         CASE WHEN s.fecha_nacimiento IS NULL THEN NULL
              ELSE extract(year FROM age(current_date, s.fecha_nacimiento))::int END AS edad,
         extract(year FROM age(current_date, s.fecha_alta))::int AS antiguedad_anios
    FROM socios s
    JOIN categorias_sociales cs ON cs.id = s.categoria_id
   WHERE s.fecha_baja IS NULL
     AND cs.cuenta_como_activo
)
SELECT (SELECT to_char(periodo_corte, 'MM/YYYY') FROM corte)      AS periodo_corte,
       count(*)::bigint                                            AS filas_del_padron_sin_filtro,
       count(*) FILTER (WHERE habilita_voto)::bigint               AS con_categoria_habilitada,
       count(*) FILTER (WHERE habilita_voto AND fecha_nacimiento IS NOT NULL
                          AND edad >= 18)::bigint                  AS mas_18_anios,
       count(*) FILTER (WHERE habilita_voto AND fecha_nacimiento IS NOT NULL
                          AND edad >= 18 AND antiguedad_anios >= 1)::bigint AS mas_1_ano_antiguedad,
       count(*) FILTER (
         WHERE habilita_voto
           AND fecha_nacimiento IS NOT NULL
           AND edad >= 18
           AND antiguedad_anios >= 1
           AND NOT EXISTS (
                 SELECT 1 FROM cuotas c
                   JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
                  WHERE c.socio_id = base.id
                    AND tc.afecta_padron
                    AND NOT c.pagada
                    AND c.periodo < (SELECT periodo_corte FROM corte)
               ))::bigint                                          AS habilitados_a_votar_replica
  FROM base;

\echo ''
\echo 'El embudo de arriba se lee de izquierda a derecha: cada columna agrega una'
\echo 'condición. La última —habilitados_a_votar_replica— es el número del padrón que'
\echo 'hay que volver a obtener DESPUÉS de re-migrar. Si cambia mucho, cambió el'
\echo 'padrón de la asamblea.'
\echo ''


\echo ''
\echo ''
\echo '################################################################################'
\echo ' 5. RESUMEN Y CRITERIO DE STOP'
\echo '################################################################################'
\echo ''
\echo 'Las cuatro condiciones de abajo se evalúan contra los mismos datos del reporte.'
\echo 'Cualquiera de ellas en STOP significa que el plan de truncate + re-migración NO'
\echo 'sigue hasta resolverla.'
\echo ''

WITH chk AS (
  SELECT 1 AS n,
         'Filas transaccionales nacidas en el ERP (ventas, ventas_items, movimientos_fondos, movimientos_stock, cuotas, turnos)'::text AS condicion,
         ( (SELECT count(*) FROM ventas             WHERE substring(id::text FROM 15 FOR 1) = '4')
         + (SELECT count(*) FROM ventas_items       WHERE substring(id::text FROM 15 FOR 1) = '4')
         + (SELECT count(*) FROM movimientos_fondos WHERE substring(id::text FROM 15 FOR 1) = '4')
         + (SELECT count(*) FROM movimientos_stock  WHERE substring(id::text FROM 15 FOR 1) = '4')
         + (SELECT count(*) FROM cuotas             WHERE substring(id::text FROM 15 FOR 1) = '4')
         + (SELECT count(*) FROM turnos             WHERE substring(id::text FROM 15 FOR 1) = '4')
         )::bigint AS valor,
         'sin plan de recuperación escrito y aprobado'::text AS salvedad
  UNION ALL
  SELECT 2, 'Vínculos de app móvil activos + invitaciones vigentes (se pierden por CASCADE)',
         ( (SELECT count(*) FROM socios_usuarios WHERE revocado_at IS NULL)
         + (SELECT count(*) FROM socios_invitaciones
             WHERE usado_at IS NULL AND revocada_at IS NULL AND expira_at > now())
         )::bigint,
         'sin un mecanismo de stash/restore YA PROBADO'
  UNION ALL
  SELECT 3, 'Invariantes de la sección 3 en desvío (incluye el desvío conocido de habilita_voto)',
         ( ((SELECT count(*) FROM categorias_sociales WHERE habilita_voto) <> 8)::int
         + ((SELECT count(*) FROM tipos_cuotas WHERE afecta_padron) <> 1)::int
         + ((SELECT count(*) FROM depositos WHERE tipo = 'punto_venta' AND caja_id IS NULL) <> 0)::int
         + ((SELECT count(*) FROM categorias_movimientos WHERE nombre = 'Ventas' AND tipo = 'ingreso') <> 1)::int
         + ((SELECT count(*) FROM categorias_movimientos
              WHERE nombre = 'Anulación de Ventas' AND tipo = 'egreso') <> 1)::int
         + ((SELECT count(*) FROM configuracion WHERE id = 1) <> 1)::int
         + ((SELECT count(*) FROM categorias_sociales WHERE NOT cuenta_como_activo) <> 2)::int
         )::bigint,
         'salvo los que estén explicados por escrito (habilita_voto = 6 lo está)'
  UNION ALL
  SELECT 4, 'Filas con versión de UUID distinta de 4 y 5 (el supuesto de la sección 0)',
         ( (SELECT count(*) FROM socios             WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))
         + (SELECT count(*) FROM cuotas             WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))
         + (SELECT count(*) FROM ventas             WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))
         + (SELECT count(*) FROM movimientos_fondos WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))
         + (SELECT count(*) FROM items_ventas       WHERE substring(id::text FROM 15 FOR 1) NOT IN ('4','5'))
         )::bigint,
         'el reporte no puede clasificar esas filas: revisarlas a mano'
)
SELECT CASE WHEN valor > 0 THEN '>>> STOP' ELSE 'ok' END AS veredicto,
       condicion, valor, salvedad
  FROM chk
 ORDER BY n;

\echo ''
\echo '--------------------------------------------------------------------------------'
\echo 'CONDICIONES DE STOP (las cuatro de arriba, más una quinta que no se puede medir'
\echo 'desde adentro):'
\echo ''
\echo '  1. Cualquier tabla TRANSACCIONAL con filas nacidas en el ERP y sin un plan de'
\echo '     recuperación escrito. Es plata, stock y cuotas reales del club.'
\echo '  2. socios_usuarios activos > 0 o invitaciones vigentes > 0 sin un mecanismo de'
\echo '     stash/restore probado. Si no, cada socio de la app hay que re-invitarlo.'
\echo '  3. Cualquier invariante de la sección 3 en DESVÍO que no esté explicado.'
\echo '  4. Cualquier fila con versión de UUID distinta de 4 o 5: el reporte no la sabe'
\echo '     clasificar y todo lo demás queda en duda.'
\echo '  5. Que este preflight falle, aborte o no llegue a correr. Un reporte parcial'
\echo '     no es un gate: no se decide con lo que alcanzó a imprimirse.'
\echo ''
\echo '--------------------------------------------------------------------------------'
\echo 'HACE FALTA APROBACIÓN HUMANA EXPLÍCITA.'
\echo ''
\echo 'Que no aparezca ningún STOP arriba NO habilita a seguir. Este reporte no aprueba'
\echo 'nada: sólo pone sobre la mesa qué se pierde. El dueño del sistema tiene que'
\echo 'decir, por escrito y sobre esta salida concreta, qué acepta perder. Sin esa'
\echo 'aprobación no se corre el TRUNCATE, haya STOP o no.'
\echo ''
\echo 'Conviene guardar esta salida con fecha (preflight_AAAA-MM-DD.txt) y volver a'
\echo 'correr el preflight DESPUÉS de re-migrar, para comparar los números "antes" y'
\echo '"después" —socios activos, cuotas impagas, padrón, invariantes— uno por uno.'
\echo '--------------------------------------------------------------------------------'
\echo ''

ROLLBACK;
