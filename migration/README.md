# Migración del sistema legacy → ATGQ-ERP

Convierte el backup MySQL del sistema anterior (`docs/backup.sql`, ~245 MB) al
esquema Postgres/Supabase del nuevo ERP.

## Idea general

El backup es enorme sólo por los **BLOBs de fotos de socios** (`Socios.Foto`) y
la tabla de auditoría `sc_log` (183k filas). La *estructura* son 34 tablas / 18 KB
(ver `docs/backup_schema.sql`, extraído del dump).

Pipeline (no se parsea el SQL a mano — se hace un roundtrip por MariaDB):

```
docs/backup.sql ──> MariaDB (Docker) ──> migrate.py ──> Postgres destino
                    (origen fiel)        (transforma)   (local o Supabase)
```

`migrate.py` genera **UUIDs deterministas**: `id = uuid5(NS, "tabla:clave_legacy")`.
Así cada FK se resuelve recomputando el uuid (sin tablas de mapeo) y la corrida
es **idempotente** (`ON CONFLICT (id) DO NOTHING`).

## Requisitos

- Docker
- El dump en `docs/backup.sql`

## 1. Cargar el legacy en MariaDB

```bash
docker network create atgq-migra
docker run -d --name atgq-migra-mysql --network atgq-migra \
  -e MARIADB_ROOT_PASSWORD=migra -e MARIADB_DATABASE=legacy \
  -v "$PWD/docs":/dump:ro \
  mariadb:11 --max-allowed-packet=1G --innodb-buffer-pool-size=512M
# esperar ~8s a que levante, luego:
docker exec atgq-migra-mysql sh -c \
  'mariadb -uroot -pmigra --force --max-allowed-packet=1G legacy < /dump/backup.sql'
```

`--force` salta 2 vistas mal ordenadas del backup (`Morosos`, `SociosActivos`,
no se usan). `--max-allowed-packet=1G` evita el corte por las filas con fotos.

## 2. Dry-run contra un Postgres local

```bash
docker run -d --name atgq-migra-pg --network atgq-migra \
  -e POSTGRES_PASSWORD=migra -e POSTGRES_DB=target postgres:15
# aplicar el esquema real (+ stub de auth.users para las FK)
docker cp supabase/migrations/20260314000001_initial_schema.sql atgq-migra-pg:/schema.sql
docker exec atgq-migra-pg psql -U postgres -d target -c \
  "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);"
docker exec atgq-migra-pg psql -U postgres -d target -f /schema.sql
docker exec atgq-migra-pg psql -U postgres -d target -c \
  "INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001','migracion@local');"

docker run --rm --network atgq-migra \
  -e MIGRATION_USER_ID=00000000-0000-4000-8000-000000000001 \
  -v "$PWD/migration":/mig -w /mig \
  python:3.11-slim sh -c "pip install -q pymysql psycopg2-binary && python migrate.py --stages all"
```

`--stages poc` corre sólo categorías+socios; `--stages all`, todo; o una lista
`--stages socios,cuotas`. `--dry-run` hace rollback (no persiste).

## 3. Corrida real contra Supabase

⚠️ **La base destino debe tener sólo el ESQUEMA, sin el seed demo.** El seed
(`supabase/seed.sql`) inserta categorías, métodos, 50 socios de prueba, etc. con
nombres que chocan contra los `UNIQUE(nombre)` reales → conflicto. Para producción:
aplicar migraciones **sin** los seeds de datos demo, luego correr esto.

```bash
export MIGRATION_USER_ID=<uuid de auth.users, p.ej. diego@diegoram.me>
docker run --rm --network atgq-migra \
  -e PG_HOST=<host> -e PG_PORT=5432 -e PG_USER=postgres \
  -e PG_PASS=<db-password> -e PG_DB=postgres -e PG_SSLMODE=require \
  -e MIGRATION_USER_ID=$MIGRATION_USER_ID \
  -v "$PWD/migration":/mig -w /mig \
  python:3.11-slim sh -c "pip install -q pymysql psycopg2-binary && python migrate.py --stages all"
```

## Decisiones de mapeo

| Tema | Decisión |
|------|----------|
| PK int → uuid | `uuid5(NS, "tabla:id")` determinista |
| Fotos (`Foto` blob) | **omitidas** (van a Storage en otra fase) |
| `usuario_id` (ventas/movs, NOT NULL) | usuario de sistema `MIGRATION_USER_ID` |
| Turnos de clientes (no socios) | **omitidos** (`socio_id` es NOT NULL) |
| `ItemsVentas` | → `items_ventas`; si `DescuentaStock=1`, además `stock_items` + inventario |
| Tesorería `tipo` E/S | E→ingreso, S→egreso; `monto = abs(importe)` |
| Movimientos sin categoría | categoría fallback "Sin categoría (migración)" |
| `importe = 0` | omitidos (`monto > 0` CHECK) |
| Fechas `0000-00-00` / día 00 | → NULL |
| Cuotas `(Mes,Año)` | → `periodo = date(Año,Mes,01)`; `pagada = FechaPago IS NOT NULL` |

## Resultado validado (dry-run 2026-07-24)

| Entidad | Legacy | Migrado | Omitidos (motivo) |
|---------|-------:|--------:|-------------------|
| socios | 8.552 | 8.552 | 0 |
| cuotas | 140.080 | 138.033 | 2.047 (socio inexistente en legacy) |
| ventas | 14.775 | 14.775 | 0 |
| ventas_items | 24.863 | 24.857 | 6 (cantidad ≤ 0 / huérfanas) |
| movimientos_fondos | 53.186 | 51.211 | 1.975 (importe 0 / caja inexistente) |
| movimientos_stock | 1.769 | 1.762 | 7 |
| items_ventas | 210 | 210 | 0 |
| clientes | 5 | 5 | 0 |

Actividades/Turnos: **vacías en el legacy** (módulos no usados). **0 FKs
huérfanas** en todo el modelo destino tras la migración.

## Limpieza

```bash
docker rm -f atgq-migra-mysql atgq-migra-pg
docker network rm atgq-migra
```
