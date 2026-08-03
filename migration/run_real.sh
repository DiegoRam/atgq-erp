#!/usr/bin/env bash
# Corrida real de la migración legacy -> Supabase (producción).
# Uso:  PGPASSWORD='<db-password>' bash migration/run_real.sh
# Requiere: MariaDB origen levantado (contenedor atgq-migra-mysql) y red atgq-migra.
set -euo pipefail

: "${PGPASSWORD:?Falta PGPASSWORD (password de la DB de Supabase)}"
MIG_USER="${MIGRATION_USER_ID:-2d880f86-4e26-4e32-99e8-6f813d3cf4b8}"  # diego@diegoram.me
PSQL="${PSQL:-/usr/local/opt/libpq/bin/psql}"
CONN="host=aws-0-us-east-1.pooler.supabase.com port=5432 user=postgres.qtlfabajjvhyluqkvike dbname=postgres sslmode=require"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==================== 1/3  LIMPIEZA SEED DEMO ===================="
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$DIR/clean_demo_seed.sql"
echo "post-limpieza (dominio debe ser 0, RBAC intacto):"
"$PSQL" "$CONN" -tAc "select rpad(t,26)||n from (
  select 'socios' t,count(*) n from socios
  union all select 'cuotas',count(*) from cuotas
  union all select 'ventas',count(*) from ventas
  union all select 'roles (preservar)',count(*) from roles
  union all select 'usuarios_roles (preservar)',count(*) from usuarios_roles) x order by t;"

echo "==================== 2/3  MIGRACIÓN (~240k filas) ===================="
docker run --rm --network atgq-migra \
  -e PG_DSN="host=aws-0-us-east-1.pooler.supabase.com port=5432 user=postgres.qtlfabajjvhyluqkvike password=$PGPASSWORD dbname=postgres sslmode=require" \
  -e MIGRATION_USER_ID="$MIG_USER" \
  -v "$DIR":/mig -w /mig \
  python:3.11-slim sh -c "pip install -q pymysql psycopg2-binary 2>/dev/null && python migrate.py --stages all"

echo "==================== 3/3  VALIDACIÓN ===================="
"$PSQL" "$CONN" -c "select
  (select count(*) from socios) socios,
  (select count(*) from cuotas) cuotas,
  (select count(*) from ventas) ventas,
  (select count(*) from ventas_items) ventas_items,
  (select count(*) from movimientos_fondos) mov_fondos,
  (select count(*) from movimientos_stock) mov_stock,
  (select count(*) from items_ventas) items;"
echo "FKs huérfanas (todas deben dar 0):"
"$PSQL" "$CONN" -tAc "select 'cuotas->socio='||count(*) from cuotas c left join socios s on s.id=c.socio_id where s.id is null;
select 'ventas_items->venta='||count(*) from ventas_items vi left join ventas v on v.id=vi.venta_id where v.id is null;
select 'movfondos->caja='||count(*) from movimientos_fondos m left join cajas c on c.id=m.caja_id where c.id is null;
select 'movfondos->cat='||count(*) from movimientos_fondos m left join categorias_movimientos c on c.id=m.categoria_id where c.id is null;
select 'socios->grupo='||count(*) from socios s where grupo_familiar_id is not null and not exists(select 1 from grupos_familiares g where g.id=s.grupo_familiar_id);"
echo "==================== LISTO ===================="
