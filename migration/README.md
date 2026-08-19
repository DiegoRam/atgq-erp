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

## 3. Corrida real contra Supabase — `run_real.sh`

**No se corre `migrate.py` a mano contra producción.** Desde agosto de 2026 el
pipeline son 6 pasos encadenados en `run_real.sh`, porque una re-migración sobre
una base EN USO tiene que preservar cosas que el legacy no puede reponer.

```bash
cp .env.migration.example .env.migration     # y completar PG_DSN
bash migration/run_real.sh --preflight        # sólo el reporte, no escribe nada
bash migration/run_real.sh --ejecutar         # la corrida real
```

| Paso | Qué hace |
|------|----------|
| 1 | `preflight.sql` — read-only: qué se pierde. **Gate humano** |
| 2 | `clean_demo_seed.sql` — snapshot a `respaldo_premigracion` + TRUNCATE |
| 3 | `migrate.py` — ~240k filas del legacy |
| 4 | `restore_datos_erp.sql` — repone lo nacido en el ERP |
| 5 | `reseed_post_migracion.sql` — repone los invariantes de política |
| 6 | validación + preflight posterior para comparar |

**El orden 4 antes que 5 no es intercambiable** (se probó al revés y pierde
datos): el reseed crea las categorías `Ventas`/`Anulación de Ventas` con ids
nuevos; si va primero ocupa el `UNIQUE (nombre, tipo)`, el restore no puede
reponer las originales del ERP, y los `movimientos_fondos` que apuntaban a
ellas quedan huérfanos.

`run_real.sh --ejecutar` aborta si: el MariaDB de origen no responde o tiene
pocos socios, no hay un `pg_dump` de producción **del día**, o no se escribe
literalmente `SI, TRUNCAR PRODUCCION`. Y sale con código ≠ 0 si alguna fila
transaccional quedó sin restaurar.

El respaldo `respaldo_premigracion` **no se borra solo**. Es la red de
seguridad: se dropea a mano cuando la migración está dada por buena.

### `migrate.py` vs `reseed_post_migracion.sql` — dónde va cada cosa

`migrate.py` es un **traductor puro** de `docs/backup.sql`: sólo escribe valores
derivables leyendo el dump, incluidas convenciones de nombres que el legacy ya
usaba operativamente (ver `CATEGORIAS_NO_ACTIVAS` en `migrate.py:116`).

Toda regla que sea **política del club posterior al legacy** — umbrales, listas
aprobadas en una reunión, vínculos inventados para una feature nueva — va en
`reseed_post_migracion.sql`, nunca en `migrate.py`. Dos pruebas para decidir un
caso dudoso: *¿se puede calcular leyendo sólo el dump?* y *¿una instalación
nueva sin legacy necesitaría igual esta fila?* En la duda, va al reseed.

Antes de escribir una migración que siembre datos por nombre sobre alguna de
las tablas de `clean_demo_seed.sql`, aplicar esas dos pruebas — si no, el
próximo truncate se lleva ese estado en silencio.

### El marcador `RESEED-STATUS` y su check

Esto no es un consejo: es un chequeo. Toda migración que haga INSERT/UPDATE
sobre una tabla truncable tiene que declarar qué pasa con ese estado al
re-migrar, con una línea grep-able:

```sql
-- RESEED-STATUS: reproducido en migrate.py (mig_categorias_sociales)
-- RESEED-STATUS: reproducido en reseed_post_migracion.sql (fragmento 2)
-- RESEED-STATUS: no aplica — <motivo concreto, no "no hace falta">
```

Lo verifica `scripts/check-reseed-marker.sh` (sin dependencias; la lista de
tablas la lee del propio `clean_demo_seed.sql` para que no se desincronicen, e
ignora los cuerpos de función, porque un `INSERT INTO ventas` dentro de
`registrar_venta` corre cuando alguien vende y no cuando se aplica la
migración):

```bash
bash scripts/check-reseed-marker.sh            # sólo las migraciones nuevas (para CI)
bash scripts/check-reseed-marker.sh --todas    # auditoría de todas
```

**Por qué existe**: en agosto de 2026 esto rompió cuatro veces en tres semanas
—las categorías del POS (el POS dejaba de vender), `depositos.caja_id` (las
ventas dejaban de impactar tesorería, en silencio), `habilita_voto` (padrón
vacío) y `afecta_padron` (el padrón habilitaba morosos)—. Tres de las cuatro
eran silenciosas y se encontraron buscándolas a mano.

**Deuda conocida**: `--todas` marca 11 migraciones ya aplicadas que no tienen
el marcador. No se les agregó a propósito: son archivos ya ejecutados en
producción y editarlos desincroniza el ledger del CLI. Sus casos ya están
resueltos (en `migrate.py` o en el reseed) y verificados en el dry-run. El
modo por defecto sólo mira las migraciones nuevas, que es lo que hay que
sostener de acá en adelante.

### Los datos de prueba no se reponen

Mientras el club siga operando en el legacy, el ERP no recibe carga real: toda
venta, movimiento o cuota que aparezca ahí es una prueba. Por eso
`restore_datos_erp.sql` **descarta las tablas transaccionales** (`ventas`,
`ventas_items`, `movimientos_fondos`, `movimientos_stock`, `stock_inventario`,
`cuotas`, `turnos`, `socios_actividades`): en cada re-migración se arranca de
cero, en vez de acumular basura de testing corrida tras corrida.

Los **catálogos sí se reponen** (categorías de tesorería, depósitos, ítems,
cajas): eso es configuración que la app necesita, no una prueba.

Descartar no es destruir: el snapshot igual las copió a
`respaldo_premigracion` y ahí quedan hasta el `DROP SCHEMA`.

**Cuando se abandone el legacy esta política se invierte** y la lista de tablas
descartadas tiene que quedar vacía — momento en el cual, probablemente, todo
este pipeline deje de tener sentido porque ya no habrá nada que truncar.

## Decisiones de mapeo

| Tema | Decisión |
|------|----------|
| PK int → uuid | `uuid5(NS, "tabla:id")` determinista |
| Fotos (`Foto` blob) | **omitidas** (van a Storage en otra fase) |
| `usuario_id` (ventas/movs, NOT NULL) | usuario de sistema `MIGRATION_USER_ID` |
| Turnos de clientes (no socios) | **omitidos** (`socio_id` es NOT NULL) |
| `ItemsVentas` | → `items_ventas`; si `DescuentaStock=1`, además `stock_items` + inventario |
| Ítems `(DESUSO)` / `No Usar` | → `activo = false`. El legacy no tenía flag de baja: se renombraba el ítem. El nombre se conserva |
| Tesorería `tipo` E/S | E→ingreso, S→egreso; `monto = abs(importe)` |
| Movimientos sin categoría | categoría fallback "Sin categoría (migración)" |
| `importe = 0` | omitidos (`monto > 0` CHECK) |
| Fechas `0000-00-00` / día 00 | → NULL |
| Cuotas `(Mes,Año)` | → `periodo = date(Año,Mes,01)`; `pagada = FechaPago IS NOT NULL` |

## Resultado validado (dry-run 2026-08-18, dump `backup_sociosonline_atygq_2026-08-17`)

El dry-run se hizo **restaurando el `pg_dump` de producción en un Postgres 17
limpio y corriendo los 6 pasos contra esa copia** — no contra un sandbox con
datos inventados. Es la única forma de que aparezcan los problemas reales: así
se encontró que `ventas_comprador_guard` abortaba `migrate.py` a mitad de
`mig_ventas`, con la base ya truncada.

| Entidad | Legacy | Migrado | Omitidos (motivo) |
|---------|-------:|--------:|-------------------|
| socios | 8.566 | 8.566 | 0 |
| cuotas | 141.419 | 139.372 | 2.047 (socio inexistente en legacy) |
| ventas | 15.221 | 15.221 | 0 (93 sin comprador: ver nota) |
| ventas_items | 25.725 | 25.719 | 6 (cantidad ≤ 0 / huérfanas) |
| movimientos_fondos | 54.628 | 52.544 | 2.084 (importe 0 / caja inexistente) |
| movimientos_stock | 1.794 | 1.787 | 7 |
| items_ventas | 212 | 212 | 0 |
| clientes | 5 | 5 | 0 |

**Total: 243.788 filas.** Actividades/Turnos siguen **vacías en el legacy**.
**0 FKs huérfanas**, y las 15 filas nacidas en el ERP se restauraron todas.

> **Nota sobre las 93 ventas sin comprador.** El legacy tiene 93 ventas sin
> socio ni cliente. `ventas_comprador_guard`
> (`…20260805000001_ventas_no_socio.sql:62-80`) las rechaza: su propio
> comentario dice que "el import legacy dejó ventas sin socio ni cliente" y las
> tolera vía la rama `TG_OP='UPDATE'` — pero eso cubre las filas ya existentes,
> no su **reinserción**, que es justo lo que hace una re-migración. `mig_ventas`
> apaga el trigger sólo para esa carga y lo vuelve a prender; el `ALTER` es
> transaccional, así que un fallo posterior lo repone con el rollback.

## Limpieza

```bash
docker rm -f atgq-migra-mysql atgq-migra-pg
docker network rm atgq-migra
```
