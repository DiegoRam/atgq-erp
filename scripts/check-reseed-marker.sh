#!/usr/bin/env bash
# =============================================================================
# check-reseed-marker.sh — evita que una migración nueva rompa la próxima
# re-migración del legacy, en silencio.
#
# EL PROBLEMA QUE PREVIENE
# ------------------------
# migration/clean_demo_seed.sql TRUNCA 22 tablas de dominio antes de re-migrar
# el sistema legacy. Toda migración que siembre datos sobre alguna de esas
# tablas pierde su efecto en el truncate, y —esto es lo grave— una migración ya
# aplicada NO se vuelve a correr, así que ese estado no vuelve nunca. La app
# sigue andando y miente.
#
# No es hipotético. En agosto de 2026 pasó cuatro veces en tres semanas:
#   · 20260803000001 — categorías 'Ventas'/'Anulación de Ventas'  -> el POS
#     dejaba de vender (RAISE EXCEPTION en registrar_venta)
#   · 20260803000004 — depositos.caja_id                          -> las ventas
#     dejaban de impactar tesorería EN SILENCIO
#   · 20260817000001 — categorias_sociales.habilita_voto          -> padrón
#     electoral VACÍO, sin error
#   · 20260817000001 — tipos_cuotas.afecta_padron                 -> el padrón
#     habilitaba a los morosos
# Los tres últimos son silenciosos. Se descubrieron buscándolos a mano.
#
# QUÉ EXIGE
# ---------
# Que toda migración que haga INSERT/UPDATE sobre una tabla truncable declare
# qué pasa con ese estado cuando se re-migre, con una línea grep-able:
#
#   -- RESEED-STATUS: reproducido en migrate.py (mig_categorias_sociales)
#   -- RESEED-STATUS: reproducido en reseed_post_migracion.sql (fragmento 2)
#   -- RESEED-STATUS: no aplica — <motivo concreto>
#
# El criterio para elegir está en migration/README.md ("migrate.py vs
# reseed_post_migracion.sql"): si el valor se deriva del dump legacy va en
# migrate.py; si es política del club, va en el reseed. En la duda, al reseed.
#
# La lista de tablas NO está hardcodeada acá: se extrae de clean_demo_seed.sql,
# para que no puedan desincronizarse.
#
# USO
#   bash scripts/check-reseed-marker.sh              # migraciones vs origin/main
#   bash scripts/check-reseed-marker.sh --todas      # todas las migraciones
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CLEAN="$RAIZ/migration/clean_demo_seed.sql"
MIGDIR="$RAIZ/supabase/migrations"

[ -f "$CLEAN" ] || { echo "No encuentro $CLEAN"; exit 1; }

# Las tablas truncables, leídas del propio TRUNCATE (única fuente de verdad).
TABLAS="$(awk '/^TRUNCATE$/{f=1;next} f{if(/RESTART IDENTITY/){exit} print}' "$CLEAN" \
          | tr ',' '\n' | tr -d ' \t' | grep -v '^$' | sort -u)"
[ -n "$TABLAS" ] || { echo "No pude extraer la lista de tablas de $CLEAN"; exit 1; }
N_TABLAS="$(printf '%s\n' "$TABLAS" | wc -l | tr -d ' ')"

# Qué migraciones mirar.
if [ "${1:-}" = "--todas" ]; then
  ARCHIVOS="$(ls "$MIGDIR"/*.sql 2>/dev/null || true)"
else
  BASE="origin/main"
  git -C "$RAIZ" rev-parse --verify -q "$BASE" >/dev/null || BASE="main"
  ARCHIVOS="$(git -C "$RAIZ" diff --name-only --diff-filter=AM "$BASE"...HEAD -- 'supabase/migrations/*.sql' 2>/dev/null \
              | sed "s|^|$RAIZ/|" || true)"
  # Las migraciones nuevas sin trackear no salen en el diff, y son justo donde
  # está el código nuevo.
  UNTRACKED="$(git -C "$RAIZ" ls-files --others --exclude-standard -- 'supabase/migrations/*.sql' 2>/dev/null \
               | sed "s|^|$RAIZ/|" || true)"
  ARCHIVOS="$(printf '%s\n%s\n' "$ARCHIVOS" "$UNTRACKED" | grep -v '^$' | sort -u || true)"
fi

if [ -z "$ARCHIVOS" ]; then
  echo "check-reseed-marker: no hay migraciones nuevas o modificadas. OK."
  exit 0
fi

FALTAN=""
REVISADAS=0
for f in $ARCHIVOS; do
  [ -f "$f" ] || continue
  REVISADAS=$((REVISADAS + 1))

  # ¿Escribe datos sobre alguna tabla truncable?
  #
  # Antes de buscar hay que sacar dos cosas, o el check grita de más y se deja
  # de leer:
  #   1. Los comentarios (los ejemplos de la propia documentación).
  #   2. Los CUERPOS DE FUNCIÓN. Un `INSERT INTO ventas` dentro de
  #      `CREATE FUNCTION registrar_venta ... $$ ... $$` corre cuando alguien
  #      vende, no cuando se aplica la migración: no siembra nada y el truncate
  #      no le hace nada. Los bloques `DO $$ ... $$` SÍ se conservan, porque
  #      esos sí ejecutan al migrar y son una forma habitual de sembrar.
  CUERPO="$(sed 's/--.*//' "$f" | awk '
    !in_func && /[Cc][Rr][Ee][Aa][Tt][Ee]([[:space:]]+[Oo][Rr][[:space:]]+[Rr][Ee][Pp][Ll][Aa][Cc][Ee])?[[:space:]]+[Ff][Uu][Nn][Cc][Tt][Ii][Oo][Nn]/ { pend = 1 }
    pend && match($0, /\$[A-Za-z_]*\$/) {
      tag = substr($0, RSTART, RLENGTH); pend = 0; in_func = 1
      resto = substr($0, RSTART + RLENGTH)
      if (index(resto, tag) > 0) in_func = 0   # abre y cierra en la misma línea
      next
    }
    in_func { if (index($0, tag) > 0) in_func = 0; next }
    { print }
  ')"
  TOCA=""
  for t in $TABLAS; do
    if printf '%s' "$CUERPO" | grep -qiE "(INSERT[[:space:]]+INTO|UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+(public\.)?${t}\b"; then
      TOCA="$TOCA $t"
    fi
  done
  [ -n "$TOCA" ] || continue

  if ! grep -qE '^[[:space:]]*--[[:space:]]*RESEED-STATUS:' "$f"; then
    FALTAN="$FALTAN\n  $(basename "$f")\n      escribe sobre:$TOCA"
  fi
done

echo "check-reseed-marker: $REVISADAS migración(es) revisada(s) contra $N_TABLAS tablas truncables."

if [ -n "$FALTAN" ]; then
  printf '\n\033[31mFALTA el marcador RESEED-STATUS en:\033[0m'
  printf "$FALTAN\n"
  cat <<'AYUDA'

Esas migraciones siembran estado sobre tablas que la re-migración del legacy
TRUNCA. Sin una decisión explícita, ese estado se pierde en la próxima
re-migración y NO vuelve (una migración aplicada no se re-ejecuta).

Agregá UNA de estas líneas al archivo, después de decidir:

  -- RESEED-STATUS: reproducido en migrate.py (<función>)
        el valor se DERIVA del dump legacy

  -- RESEED-STATUS: reproducido en reseed_post_migracion.sql (fragmento N)
        es política del club: no existe en el legacy. Acordate de agregar
        el fragmento, no sólo el comentario.

  -- RESEED-STATUS: no aplica — <motivo concreto, no "no hace falta">
        p.ej. el UPDATE es sobre filas que migrate.py vuelve a escribir igual

Criterio completo en migration/README.md, sección
"migrate.py vs reseed_post_migracion.sql".
AYUDA
  exit 1
fi

echo "OK: ninguna migración siembra estado truncable sin declarar qué pasa al re-migrar."
