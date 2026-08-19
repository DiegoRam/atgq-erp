#!/usr/bin/env bash
# =============================================================================
# run_real.sh — Re-migración del sistema legacy sobre la base de PRODUCCIÓN.
#
# ESTO TRUNCA 22 TABLAS DE PRODUCCIÓN. No es reversible sin el pg_dump.
#
# Uso:
#   bash migration/run_real.sh --preflight        # sólo el reporte, no escribe nada
#   bash migration/run_real.sh --ejecutar         # la corrida real (pide confirmación)
#
# Requisitos previos (el script los verifica y aborta si faltan):
#   1. .env.migration con PG_DSN (session pooler; ver el archivo).
#   2. MariaDB con el dump legacy cargado: contenedor atgq-migra-mysql en la
#      red atgq-migra (ver migration/README.md paso 1).
#   3. Un pg_dump de producción hecho HOY. Es el único rollback que existe.
#
# POR QUÉ SON 6 PASOS Y NO 3
# --------------------------
# La corrida de julio 2026 era: limpiar, migrar, validar. Alcanzaba porque la
# base sólo tenía seed demo. Desde entonces la app estuvo en uso y aparecieron
# dos clases de estado que el TRUNCATE destruye y el legacy no puede reponer:
#
#   a) Filas nacidas en el ERP (ventas del POS, movimientos, vínculos de app
#      móvil). Las salva el snapshot del paso 2 + el restore del paso 4.
#   b) Invariantes que sembraron las migraciones posteriores a julio
#      (habilita_voto, afecta_padron, depositos.caja_id, las categorías de
#      tesorería que exige registrar_venta). Los repone el reseed del paso 5.
#
# EL ORDEN ES restore ANTES QUE reseed, Y NO ES INTERCAMBIABLE.
# Se probó al revés y pierde datos. Las únicas filas que el reseed CREA son las
# dos categorías de tesorería del POS ('Ventas'/ingreso y 'Anulación de
# Ventas'/egreso), y las crea con ids nuevos. Si el reseed va primero, ocupa el
# UNIQUE (nombre, tipo); después el restore no puede reponer las categorías
# originales nacidas en el ERP —choca— y todo movimiento_fondos que apuntaba a
# ellas queda huérfano y se pierde. Con el restore primero, las categorías
# vuelven con SU id, los movimientos las encuentran, y el INSERT del reseed
# hace ON CONFLICT DO NOTHING y su guard igual da 2/2.
# =============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$DIR/.." && pwd)"
PSQL="${PSQL:-/usr/local/opt/libpq/bin/psql}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
LOGDIR="${LOGDIR:-$HOME/atgq-erp-backups}"

PASO_ACTUAL="0 (arranque)"

# Si el script corta a mitad, lo peor que puede pasar es que el operador no
# sepa en qué estado quedó producción. Entre el paso 2 (que commitea el
# TRUNCATE) y el 4 (que repone lo del ERP), la base está VACÍA y el respaldo
# es lo único que queda: hay que decirlo con todas las letras y dar el camino
# de vuelta, no dejar un stack trace de bash.
trap 'ec=$?; if [ $ec -ne 0 ]; then
  printf "\033[31m\n=========== CORTÓ EN EL PASO %s (exit %s) ===========\033[0m\n" "$PASO_ACTUAL" "$ec"
  case "$PASO_ACTUAL" in
    2*|3*) printf "\033[31m%s\033[0m\n" \
        "El TRUNCATE puede estar YA COMMITEADO: las tablas de dominio estarían VACÍAS." \
        "NO vuelvas a correr este script desde cero: el paso 2 aborta al ver el respaldo," \
        "y borrarlo perdería lo único que queda de lo nacido en el ERP." \
        "Seguí a mano desde donde cortó:" \
        "  3) docker run --rm --network atgq-migra -e PG_DSN=... -e MIGRATION_USER_ID=... \\" \
        "       -v $DIR:/mig -w /mig python:3.11-slim sh -c \"pip install -q pymysql psycopg2-binary && python migrate.py --stages all\"" \
        "  4) psql -f $DIR/restore_datos_erp.sql" \
        "  5) psql -f $DIR/reseed_post_migracion.sql" \
        "Y si todo falla: pg_restore del dump en $LOGDIR." ;;
    4*|5*) printf "\033[31m%s\033[0m\n" \
        "La migración está commiteada pero falta reponer estado. Corré a mano:" \
        "  4) psql -f $DIR/restore_datos_erp.sql" \
        "  5) psql -f $DIR/reseed_post_migracion.sql" ;;
    *) printf "\033[31m%s\033[0m\n" "No se llegó a escribir nada en producción." ;;
  esac
fi' EXIT

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
titulo(){ printf '\n\033[1m==================== %s ====================\033[0m\n' "$*"; }

# -----------------------------------------------------------------------------
# Configuración y chequeos previos
# -----------------------------------------------------------------------------
[ -f "$RAIZ/.env.migration" ] || { rojo "Falta $RAIZ/.env.migration (ver el ejemplo en el repo)"; exit 1; }
set -a; . "$RAIZ/.env.migration"; set +a
: "${PG_DSN:?Falta PG_DSN en .env.migration}"
: "${MIGRATION_USER_ID:?Falta MIGRATION_USER_ID en .env.migration}"

[ -x "$PSQL" ] || { rojo "No encuentro psql en $PSQL (brew install libpq)"; exit 1; }

# -----------------------------------------------------------------------------
# Sacar la password de la línea de comandos.
#
# `psql "$PG_DSN"` deja la password de producción en argv, y /proc/<pid>/cmdline
# lo lee cualquier usuario de la máquina. Los pasos 2/3/4 duran minutos. Se
# parte el DSN en variables PG* (que sólo lee el mismo usuario y root) y se
# invoca psql sin argumentos de conexión.
# -----------------------------------------------------------------------------
eval "$(python3 "$DIR/_dsn_to_env.py" "$PG_DSN")"
# A partir de acá psql se llama SIN DSN: toma todo de las PG*.
psqlq() { "$PSQL" -tAc "$1"; }

# Que quede claro contra qué base se está por operar, acá y no 40 pantallas
# más arriba en la cabecera del preflight.
verde "Destino: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"

MODO="${1:-}"
case "$MODO" in
  --preflight|--ejecutar) ;;
  *) rojo "Uso: bash migration/run_real.sh [--preflight|--ejecutar]"; exit 1 ;;
esac

mkdir -p "$LOGDIR"

# -----------------------------------------------------------------------------
# PASO 1 — PREFLIGHT (read-only). Siempre corre, en los dos modos.
# -----------------------------------------------------------------------------
PASO_ACTUAL="1 (preflight)"
titulo "1/6  PREFLIGHT (read-only)"
PREFLIGHT_OUT="$LOGDIR/preflight_$STAMP.txt"
"$PSQL" -f "$DIR/preflight.sql" 2>&1 | tee "$PREFLIGHT_OUT"
verde "Reporte guardado en $PREFLIGHT_OUT"

if [ "$MODO" = "--preflight" ]; then
  echo
  verde "Modo --preflight: no se escribió nada. Revisá el reporte y, si corresponde, corré --ejecutar."
  exit 0
fi

# -----------------------------------------------------------------------------
# Verificaciones que sólo importan en la corrida real
# -----------------------------------------------------------------------------
titulo "VERIFICACIONES PREVIAS"

# El origen tiene que estar levantado y con datos: si migrate.py corre contra
# una MariaDB vacía, trunca producción y no repone nada.
docker exec atgq-migra-mysql mariadb -uroot -pmigra -N -B legacy \
  -e "select count(*) from Socios;" >/tmp/.atgq_socios_src 2>/dev/null \
  || { rojo "No puedo consultar el MariaDB de origen (contenedor atgq-migra-mysql). Ver README paso 1."; exit 1; }
SOCIOS_SRC="$(cat /tmp/.atgq_socios_src)"; rm -f /tmp/.atgq_socios_src
# El chequeo numérico va ANTES de la comparación: si SOCIOS_SRC viniera vacío o
# no numérico, `[ "$x" -lt N ]` sale con código 2 ("integer expression
# expected") y, por estar en la condición de un `if`, set -e NO lo frena: el
# script seguiría de largo hasta truncar producción. Verificado.
if ! [[ "$SOCIOS_SRC" =~ ^[0-9]+$ ]]; then
  rojo "El conteo de socios del origen no es un número (got: '$SOCIOS_SRC'). Abortando."
  exit 1
fi
if [ "$SOCIOS_SRC" -lt 1000 ]; then
  rojo "El MariaDB de origen tiene sólo $SOCIOS_SRC socios: el dump no está cargado bien. Abortando."
  exit 1
fi
verde "Origen OK: $SOCIOS_SRC socios en MariaDB."

# El respaldo es el único rollback. Sin él no se sigue.
DUMP="$(ls -t "$LOGDIR"/prod_pre_remigracion_*.dump 2>/dev/null | head -1 || true)"
if [ -z "$DUMP" ] || [ ! -s "$DUMP" ]; then
  rojo "No hay pg_dump de producción en $LOGDIR (prod_pre_remigracion_*.dump), o está vacío."
  rojo "Hacelo antes de seguir:"
  rojo "  docker run --rm -e DSN=\"\$PG_DSN\" -v \"$LOGDIR\":/out postgres:17 \\"
  rojo "    sh -c 'pg_dump \"\$DSN\" -Fc --no-owner --no-acl -f /out/prod_pre_remigracion_\$(date +%F).dump'"
  exit 1
fi
# Antigüedad del respaldo: se INFORMA, no se veta.
#
# `ls -t` devuelve feliz el dump de un intento de hace semanas, y un rollback
# que no incluye la actividad reciente es peor que no tener rollback, porque
# parece que sí. Pero cuánto riesgo se acepta es una decisión del dueño del
# sistema, no del script: puede saber perfectamente que desde ese dump no
# cambió nada. Lo único que corresponde es que tenga el dato delante en el
# momento de decidir — por eso se muestra pegado al prompt de confirmación, y
# no como un aviso 40 líneas antes que se pierde en el scroll.
DUMP_DIA="$(date -r "$DUMP" +%F 2>/dev/null || stat -c %y "$DUMP" 2>/dev/null | cut -d' ' -f1)"
HOY="$(date +%F)"
DUMP_EDAD_AVISO=""
if [ "$DUMP_DIA" != "$HOY" ]; then
  DUMP_SEG="$(date -r "$DUMP" +%s 2>/dev/null || echo 0)"
  AHORA_SEG="$(date +%s)"
  DIAS=$(( (AHORA_SEG - DUMP_SEG) / 86400 ))
  DUMP_EDAD_AVISO="El respaldo es del $DUMP_DIA (hace ~$DIAS día(s)), no de hoy ($HOY).
Todo lo que haya cambiado en producción desde entonces NO se puede recuperar."
fi
# Que el archivo exista y pese tampoco alcanza: un pg_dump que murió a la
# mitad deja un archivo grande e ilegible. `pg_restore -l` lee el índice
# completo, así que un archivo truncado falla acá y no el día que haga falta
# restaurarlo. Se usa la imagen de docker porque el pg_restore local puede ser
# de una versión anterior a la del server (no lee su formato de archivo).
if ! docker run --rm -v "$LOGDIR":/out postgres:17 \
      pg_restore -l "/out/$(basename "$DUMP")" >/dev/null 2>&1; then
  rojo "El respaldo $DUMP está corrupto o truncado: pg_restore -l no puede leerlo."
  rojo "Hacé uno nuevo. NO sigas: sería truncar producción sin rollback."
  exit 1
fi
verde "Respaldo encontrado y verificado: $DUMP ($(du -h "$DUMP" | cut -f1), del $DUMP_DIA)"

echo
rojo "A partir de acá se TRUNCAN 22 TABLAS DE PRODUCCIÓN y se re-migra el legacy."
echo "  destino: $PGUSER@$PGHOST/$PGDATABASE"
echo "  respaldo: $DUMP ($DUMP_DIA)"
if [ -n "$DUMP_EDAD_AVISO" ]; then
  echo
  rojo "AVISO — RESPALDO NO ES DE HOY"
  rojo "$DUMP_EDAD_AVISO"
  rojo "Si sabés que desde esa fecha no cambió nada, seguí. Si no, cortá con Ctrl-C"
  rojo "y hacé uno nuevo. La decisión es tuya; el script no la toma por vos."
fi
echo
echo "Escribí exactamente  SI, TRUNCAR PRODUCCION  para continuar:"
read -r CONFIRMA
[ "$CONFIRMA" = "SI, TRUNCAR PRODUCCION" ] || { rojo "Cancelado."; exit 1; }

# -----------------------------------------------------------------------------
# PASO 2 — SNAPSHOT + TRUNCATE
# -----------------------------------------------------------------------------
PASO_ACTUAL="2 (snapshot + truncate)"
titulo "2/6  SNAPSHOT DE LO NACIDO EN EL ERP + TRUNCATE"
"$PSQL" -v ON_ERROR_STOP=1 -f "$DIR/clean_demo_seed.sql"

# -----------------------------------------------------------------------------
# PASO 3 — MIGRACIÓN (~240k filas)
# -----------------------------------------------------------------------------
PASO_ACTUAL="3 (migrate.py)"
titulo "3/6  MIGRACIÓN DEL LEGACY (~240k filas)"
docker run --rm --network atgq-migra \
  -e PG_DSN="$PG_DSN" \
  -e MIGRATION_USER_ID="$MIGRATION_USER_ID" \
  -v "$DIR":/mig -w /mig \
  python:3.11-slim \
  sh -c "pip install -q pymysql psycopg2-binary 2>/dev/null && python migrate.py --stages all"

# -----------------------------------------------------------------------------
# PASO 4 — RESTORE de lo nacido en el ERP (ANTES del reseed; ver cabecera)
# -----------------------------------------------------------------------------
PASO_ACTUAL="4 (restore)"
titulo "4/6  RESTORE DE LAS FILAS NACIDAS EN EL ERP"
"$PSQL" -v ON_ERROR_STOP=1 -f "$DIR/restore_datos_erp.sql"

# -----------------------------------------------------------------------------
# PASO 5 — RESEED de los invariantes que el legacy no trae
# -----------------------------------------------------------------------------
PASO_ACTUAL="5 (reseed)"
titulo "5/6  RESEED DE ESTADO POST-LEGACY"
"$PSQL" -v ON_ERROR_STOP=1 -f "$DIR/reseed_post_migracion.sql"

# -----------------------------------------------------------------------------
# PASO 6 — VALIDACIÓN
# -----------------------------------------------------------------------------
PASO_ACTUAL="6 (validación)"
titulo "6/6  VALIDACIÓN"

# ---------------------------------------------------------------------------
# Gate: filas que el restore NO pudo reponer.
#
# OJO con el alcance: las tablas transaccionales (ventas, movimientos, cuotas)
# se DESCARTAN a propósito — mientras el club opere en el legacy, lo que
# aparezca ahí son pruebas y en cada re-migración se arranca de cero (ver la
# POLÍTICA en restore_datos_erp.sql). Descartadas no generan rechazos, así que
# no entran acá.
#
# Lo que sí importa es un CATÁLOGO que no volvió: una categoría de tesorería,
# un depósito o un ítem creado desde el ERP es configuración que la app
# necesita, y perderlo rompe pantallas. Sin este chequeo eso terminaría con un
# "LISTO" verde. Las filas siguen en el respaldo: esto avisa, no las borra.
# ---------------------------------------------------------------------------
RECHAZOS="$("$PSQL" -tAc "
  SELECT coalesce(count(DISTINCT (tabla, id)), 0)
    FROM respaldo_premigracion.rechazos;" 2>/dev/null || echo "?")"
ESTADO_FINAL=0
if [ "$RECHAZOS" != "0" ]; then
  rojo "ATENCIÓN: $RECHAZOS fila(s) de catálogo quedaron SIN reponer."
  "$PSQL" -c "SELECT tabla, motivo, count(DISTINCT id) filas
     FROM respaldo_premigracion.rechazos
    GROUP BY 1,2 ORDER BY 1,2;"
  rojo "Siguen guardadas en respaldo_premigracion. Revisalas ANTES de dar la migración por buena."
  rojo "Detalle: SELECT * FROM respaldo_premigracion.rechazos;"
  ESTADO_FINAL=1
else
  verde "Todos los catálogos nacidos en el ERP se repusieron."
fi

# Lo descartado a propósito se informa, no falla.
"$PSQL" -c "SELECT tabla, respaldadas AS filas_de_prueba_descartadas
              FROM respaldo_premigracion.restore_log
             WHERE descartada AND respaldadas > 0 ORDER BY orden;"

POST_OUT="$LOGDIR/preflight_POST_$STAMP.txt"
"$PSQL" -f "$DIR/preflight.sql" 2>&1 | tee "$POST_OUT"
verde "Reporte posterior guardado en $POST_OUT"

echo
echo "--- Conteos ---"
"$PSQL" -c "select
  (select count(*) from socios) socios,
  (select count(*) from cuotas) cuotas,
  (select count(*) from ventas) ventas,
  (select count(*) from ventas_items) ventas_items,
  (select count(*) from movimientos_fondos) mov_fondos,
  (select count(*) from movimientos_stock) mov_stock,
  (select count(*) from items_ventas) items;"

# -----------------------------------------------------------------------------
# Gate de FKs e invariantes.
#
# Va todo en UNA sentencia a propósito. `psql -c "sel1; sel2; sel3"` imprime
# SÓLO el último result set en psql 13 (el de libpq en esta Mac); psql 17 los
# imprime todos. O sea que la versión anterior de estos chequeos mostraba una
# sola línea y las otras siete se perdían en silencio — un gate que no se ve no
# es un gate. Verificado contra producción.
#
# Y no alcanza con imprimir: el DO de abajo hace RAISE, así que un desvío
# devuelve exit != 0 en vez de terminar en verde.
# -----------------------------------------------------------------------------
echo "--- FKs huérfanas e invariantes ---"
"$PSQL" -c "
WITH chk(orden, nombre, encontrado, esperado) AS (VALUES
  (1,'FK cuotas->socio',            (SELECT count(*) FROM cuotas c LEFT JOIN socios s ON s.id=c.socio_id WHERE s.id IS NULL), 0),
  (2,'FK ventas_items->venta',      (SELECT count(*) FROM ventas_items vi LEFT JOIN ventas v ON v.id=vi.venta_id WHERE v.id IS NULL), 0),
  (3,'FK ventas->punto_venta',      (SELECT count(*) FROM ventas v LEFT JOIN depositos d ON d.id=v.punto_venta_id WHERE d.id IS NULL), 0),
  (4,'FK movfondos->caja',          (SELECT count(*) FROM movimientos_fondos m LEFT JOIN cajas c ON c.id=m.caja_id WHERE c.id IS NULL), 0),
  (5,'FK movfondos->categoria',     (SELECT count(*) FROM movimientos_fondos m LEFT JOIN categorias_movimientos c ON c.id=m.categoria_id WHERE c.id IS NULL), 0),
  (6,'FK socios->grupo',            (SELECT count(*) FROM socios s WHERE grupo_familiar_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM grupos_familiares g WHERE g.id=s.grupo_familiar_id)), 0),
  (7,'FK socios_usuarios->socio',   (SELECT count(*) FROM socios_usuarios su LEFT JOIN socios s ON s.id=su.socio_id WHERE s.id IS NULL), 0),
  (8,'FK socios_invitaciones->socio',(SELECT count(*) FROM socios_invitaciones si LEFT JOIN socios s ON s.id=si.socio_id WHERE s.id IS NULL), 0),
  (9,'categorias con habilita_voto',(SELECT count(*) FROM categorias_sociales WHERE habilita_voto), 8),
  (10,'tipos_cuotas afecta_padron', (SELECT count(*) FROM tipos_cuotas WHERE afecta_padron), 1),
  (11,'categorias del POS',         (SELECT count(*) FROM categorias_movimientos WHERE (nombre,tipo) IN (('Ventas','ingreso'),('Anulación de Ventas','egreso'))), 2)
)
SELECT nombre, encontrado, esperado,
       CASE WHEN encontrado = esperado THEN 'ok' ELSE '>>> FALLA' END AS estado
  FROM chk ORDER BY orden;"

# Informativo, sin umbral: 'Tiro Practico' no tiene caja homónima en el legacy
# y 'Ajuste' nació en el ERP sin caja. Es el estado actual de producción, no una
# regresión, así que se muestra pero NO dispara el gate — un gate que grita
# siempre deja de leerse.
echo "--- Puntos de venta sin caja (informativo, ver README) ---"
"$PSQL" -c "SELECT nombre FROM depositos WHERE tipo='punto_venta' AND caja_id IS NULL ORDER BY nombre;"

if ! "$PSQL" -v ON_ERROR_STOP=1 -q -c "
DO \$\$
DECLARE v_fallas text;
BEGIN
  SELECT string_agg(nombre || ' (encontrado ' || encontrado || ', esperado ' || esperado || ')', '; ')
    INTO v_fallas
    FROM (VALUES
      ('FK cuotas->socio',            (SELECT count(*) FROM cuotas c LEFT JOIN socios s ON s.id=c.socio_id WHERE s.id IS NULL), 0),
      ('FK ventas_items->venta',      (SELECT count(*) FROM ventas_items vi LEFT JOIN ventas v ON v.id=vi.venta_id WHERE v.id IS NULL), 0),
      ('FK ventas->punto_venta',      (SELECT count(*) FROM ventas v LEFT JOIN depositos d ON d.id=v.punto_venta_id WHERE d.id IS NULL), 0),
      ('FK movfondos->caja',          (SELECT count(*) FROM movimientos_fondos m LEFT JOIN cajas c ON c.id=m.caja_id WHERE c.id IS NULL), 0),
      ('FK movfondos->categoria',     (SELECT count(*) FROM movimientos_fondos m LEFT JOIN categorias_movimientos c ON c.id=m.categoria_id WHERE c.id IS NULL), 0),
      ('FK socios->grupo',            (SELECT count(*) FROM socios s WHERE grupo_familiar_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM grupos_familiares g WHERE g.id=s.grupo_familiar_id)), 0),
      ('FK socios_usuarios->socio',   (SELECT count(*) FROM socios_usuarios su LEFT JOIN socios s ON s.id=su.socio_id WHERE s.id IS NULL), 0),
      ('FK socios_invitaciones->socio',(SELECT count(*) FROM socios_invitaciones si LEFT JOIN socios s ON s.id=si.socio_id WHERE s.id IS NULL), 0),
      ('categorias con habilita_voto',(SELECT count(*) FROM categorias_sociales WHERE habilita_voto), 8),
      ('tipos_cuotas afecta_padron',  (SELECT count(*) FROM tipos_cuotas WHERE afecta_padron), 1),
      ('categorias del POS',          (SELECT count(*) FROM categorias_movimientos WHERE (nombre,tipo) IN (('Ventas','ingreso'),('Anulación de Ventas','egreso'))), 2)
    ) AS t(nombre, encontrado, esperado)
   WHERE encontrado <> esperado;

  IF v_fallas IS NOT NULL THEN
    RAISE EXCEPTION 'Validación post-migración FALLIDA: %', v_fallas;
  END IF;
END \$\$;"; then
  rojo "El gate de validación falló (ver el detalle arriba)."
  ESTADO_FINAL=1
fi

if [ "${ESTADO_FINAL:-0}" -ne 0 ]; then
  titulo "TERMINÓ CON FILAS SIN RESTAURAR"
  rojo "La migración corrió, pero hay filas transaccionales sin reponer (ver arriba)."
  rojo "NO la des por buena hasta resolverlas. El respaldo sigue intacto."
else
  titulo "LISTO"
fi
echo "Comparar contra el preflight previo:"
echo "  diff <(sed -n '/3. INVARIANTES/,/4. NUMERO/p' \"$PREFLIGHT_OUT\") \\"
echo "       <(sed -n '/3. INVARIANTES/,/4. NUMERO/p' \"$POST_OUT\")"
echo
# El respaldo bloquea la corrida siguiente (el paso 2 aborta si lo encuentra con
# filas), y como esto se re-corre muchas veces mientras el club siga en el
# legacy, esa fricción aparece TODAS las veces. El mensaje de aquel guard es
# deliberadamente cauto ("no lo borres sin mirar"), así que la duda la tiene que
# resolver el script, que sí sabe cómo salió la corrida — no el operador de
# memoria a la semana siguiente.
if [ "${ESTADO_FINAL:-0}" -eq 0 ]; then
  verde "El gate pasó limpio: el respaldo ya cumplió su función y es seguro borrarlo."
  echo   "Hacelo antes de la próxima re-migración (si no, el paso 2 aborta al encontrarlo):"
  echo   "    PGPASSWORD=… $PSQL -c 'DROP SCHEMA respaldo_premigracion CASCADE;'"
  echo   "  o, más simple, con el entorno ya cargado:"
  echo   "    set -a; . .env.migration; set +a; bash -c 'eval \"\$(sed -n \"/^PG_DSN=/p\" .env.migration)\"'"
  echo   "    $PSQL \"\$PG_DSN\" -c 'DROP SCHEMA respaldo_premigracion CASCADE;'"
else
  rojo   "NO borres respaldo_premigracion todavía: el gate no pasó limpio (ver arriba)."
  rojo   "Es lo único que queda de lo que no se pudo reponer."
fi

exit "${ESTADO_FINAL:-0}"
