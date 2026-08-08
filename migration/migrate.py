#!/usr/bin/env python3
"""
Migración legacy (MySQL/MariaDB) -> nuevo modelo (Supabase/Postgres).

Estrategia:
- UUIDs DETERMINISTAS: cada id nuevo = uuid5(NS, f"{tabla}:{clave_legacy}").
  Así toda FK se resuelve recomputando el uuid, sin tablas de mapeo, y la
  migración es idempotente (re-ejecutable) usando ON CONFLICT DO NOTHING.
- Origen: MariaDB con el dump cargado (ver migration/README.md).
- Destino: cualquier Postgres con el esquema del proyecto aplicado
  (Postgres local para el dry-run, Supabase para la corrida real).

Config por variables de entorno (ver migration/README.md):
  SRC_HOST/PORT/USER/PASS/DB   -> MariaDB origen
  PG_HOST/PORT/USER/PASS/DB    -> Postgres destino
  MIGRATION_USER_ID            -> uuid de auth.users para los registros
                                  históricos (ventas, movimientos). Requerido
                                  para las fases que lo usan.
"""
import os
import uuid
import argparse
import datetime

import pymysql
import psycopg2
from psycopg2.extras import execute_values

NS = uuid.UUID("a1b2c3d4-0000-4000-8000-a7a7a7a70001")

# Categorías de tesorería fallback (para movimientos sin categoria_id)
CAT_FALLBACK_ING = str(uuid.uuid5(NS, "categorias_movimientos:__fallback_ingreso"))
CAT_FALLBACK_EGR = str(uuid.uuid5(NS, "categorias_movimientos:__fallback_egreso"))


def nid(table, key):
    return str(uuid.uuid5(NS, f"{table}:{key}"))


def clean_date(v):
    if v in (None, "", "0000-00-00", b"0000-00-00"):
        return None
    v = str(v)
    date_part = v[:10]
    parts = date_part.split("-")
    # MySQL permite mes/día 00 (ej. '2001-12-00'); Postgres no -> anular
    if len(parts) == 3 and (parts[1] == "00" or parts[2] == "00"
                            or parts[0] == "0000"):
        return None
    return v


def s(v):
    if v is None:
        return None
    v = str(v).strip()
    return v if v != "" else None


def mig_user():
    u = os.environ.get("MIGRATION_USER_ID")
    if not u:
        raise SystemExit(
            "Falta MIGRATION_USER_ID (uuid de auth.users) para fases "
            "de ventas/movimientos.")
    return u


# --------------------------------------------------------------------------
def connect_source():
    return pymysql.connect(
        host=os.environ.get("SRC_HOST", "atgq-migra-mysql"),
        port=int(os.environ.get("SRC_PORT", "3306")),
        user=os.environ.get("SRC_USER", "root"),
        password=os.environ.get("SRC_PASS", "migra"),
        database=os.environ.get("SRC_DB", "legacy"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def connect_target():
    dsn = os.environ.get("PG_DSN")
    if dsn:  # p.ej. pooler de Supabase (usuario postgres.<ref>)
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host=os.environ.get("PG_HOST", "atgq-migra-pg"),
        port=int(os.environ.get("PG_PORT", "5432")),
        user=os.environ.get("PG_USER", "postgres"),
        password=os.environ.get("PG_PASS", "migra"),
        dbname=os.environ.get("PG_DB", "target"),
        sslmode=os.environ.get("PG_SSLMODE", "prefer"),
    )


def copy(pg, sql, rows):
    if not rows:
        return 0
    with pg.cursor() as cur:
        execute_values(cur, sql, rows, page_size=1000)
    return len(rows)


def ids(pg, table):
    with pg.cursor() as cur:
        cur.execute(f"SELECT id FROM {table}")
        return {x[0] for x in cur.fetchall()}


# ==========================================================================
# SOCIOS
# ==========================================================================
# Categorías cuyos socios NO cuentan como activos. En el legacy el estado real
# del socio vive acá y no en FechaBaja, así que sin esto el KPI "Socios Activos"
# del dashboard incluye las bajas. Las "-Ventanilla" sí cuentan como socios.
CATEGORIAS_NO_ACTIVAS = {"BAJA", "INACTIVO"}


def mig_categorias_sociales(my, pg):
    with my.cursor() as c:
        c.execute("SELECT * FROM CategoriasSocios")
        src = c.fetchall()
    rows = []
    for r in src:
        nombre = s(r["Descripcion"]) or f"Categoria {r['idCategorias']}"
        rows.append((nid("categorias_sociales", r["idCategorias"]),
                     nombre, None, r["Monto"], bool(r["CategoriaActiva"]),
                     nombre.strip().upper() not in CATEGORIAS_NO_ACTIVAS))
    return copy(pg, "INSERT INTO categorias_sociales "
                "(id,nombre,descripcion,monto_base,activa,cuenta_como_activo) "
                "VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_metodos_cobranza(my, pg):
    with my.cursor() as c:
        c.execute("SELECT * FROM Cobranza")
        src = c.fetchall()
    rows = [(nid("metodos_cobranza", r["idCobranza"]),
             s(r["Descripcion"]) or f"Cobranza {r['idCobranza']}", True)
            for r in src]
    return copy(pg, "INSERT INTO metodos_cobranza (id,nombre,activo) "
                "VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_tipos_cuotas(my, pg):
    with my.cursor() as c:
        c.execute("SELECT * FROM TipoCuota")
        src = c.fetchall()
    rows = [(nid("tipos_cuotas", r["idTipoCuota"]),
             s(r["Descripcion"]) or f"Tipo {r['idTipoCuota']}", True)
            for r in src]
    return copy(pg, "INSERT INTO tipos_cuotas (id,nombre,activo) VALUES %s "
                "ON CONFLICT (id) DO NOTHING", rows)


def mig_socios(my, pg):
    cat_ok, cob_ok = ids(pg, "categorias_sociales"), ids(pg, "metodos_cobranza")
    with my.cursor() as c:
        c.execute("""
            SELECT NroSocio, Apellido, Nombre, DNI,
                   Categorias_idCategorias, Cobranza_idCobranza, Ciudad,
                   CAST(FechaAlta AS CHAR)       AS FechaAlta,
                   CAST(FechaBaja AS CHAR)       AS FechaBaja,
                   CAST(FechaNacimiento AS CHAR) AS FechaNacimiento
            FROM Socios""")
        src = c.fetchall()
    rows, dni_seen, skip_cat = [], set(), 0
    for r in src:
        cat = nid("categorias_sociales", r["Categorias_idCategorias"])
        if cat not in cat_ok:
            skip_cat += 1
            continue
        cob = nid("metodos_cobranza", r["Cobranza_idCobranza"])
        cob = cob if cob in cob_ok else None
        dni = s(r["DNI"]) or str(r["NroSocio"])
        if dni in dni_seen:
            dni = f"{dni}-{r['NroSocio']}"
        dni_seen.add(dni)
        rows.append((
            nid("socios", r["NroSocio"]), r["NroSocio"],
            s(r["Apellido"]) or "-", s(r["Nombre"]) or "-", dni, cat,
            clean_date(r["FechaAlta"]) or "1900-01-01",
            clean_date(r["FechaBaja"]), cob, None,
            s(r["Ciudad"]), clean_date(r["FechaNacimiento"])))
    n = copy(pg, "INSERT INTO socios (id,nro_socio,apellido,nombre,dni,"
             "categoria_id,fecha_alta,fecha_baja,metodo_cobranza_id,"
             "grupo_familiar_id,localidad,fecha_nacimiento) VALUES %s "
             "ON CONFLICT (id) DO NOTHING", rows)
    print(f"    socios origen={len(src)} insertados={n} omit_cat={skip_cat}")
    return n


def mig_grupos_familiares(my, pg):
    socio_ok = ids(pg, "socios")
    with my.cursor() as c:
        c.execute("SELECT Socios_idSocios, SocioTitular FROM GruposFamiliares")
        src = c.fetchall()
    grupos, miembros = {}, []      # titular_nro -> uuid grupo
    for r in src:
        tit = r["SocioTitular"]
        if tit is None:
            continue
        tit_uuid = nid("socios", tit)
        if tit_uuid not in socio_ok:
            continue
        gid = nid("grupos_familiares", tit)
        grupos[tit] = (gid, tit_uuid)
        for nro in (r["Socios_idSocios"], tit):   # miembro + titular
            su = nid("socios", nro)
            if su in socio_ok:
                miembros.append((su, gid))
    # 1) insertar grupos (titular_id se setea luego para evitar FK circular)
    copy(pg, "INSERT INTO grupos_familiares (id,titular_id) VALUES %s "
         "ON CONFLICT (id) DO NOTHING",
         [(g, None) for g, _ in grupos.values()])
    with pg.cursor() as cur:
        for tit, (gid, tit_uuid) in grupos.items():
            cur.execute("UPDATE grupos_familiares SET titular_id=%s WHERE id=%s",
                        (tit_uuid, gid))
        for su, gid in miembros:
            cur.execute("UPDATE socios SET grupo_familiar_id=%s WHERE id=%s",
                        (gid, su))
    print(f"    grupos={len(grupos)} miembros_actualizados={len(miembros)}")
    return len(grupos)


def mig_cuotas(my, pg):
    socio_ok, tipo_ok = ids(pg, "socios"), ids(pg, "tipos_cuotas")
    with my.cursor() as c:
        c.execute("SELECT idCuotas,Socios_NroSocio,MesCuota,AnoCuota,tipo,"
                  "CAST(FechaPago AS CHAR) AS FechaPago,Monto FROM Cuotas")
        src = c.fetchall()
    rows, skip = [], {"socio": 0, "tipo": 0, "periodo": 0}
    for r in src:
        so = nid("socios", r["Socios_NroSocio"])
        if so not in socio_ok:
            skip["socio"] += 1; continue
        ti = nid("tipos_cuotas", r["tipo"])
        if ti not in tipo_ok:
            skip["tipo"] += 1; continue
        mes, ano = r["MesCuota"], r["AnoCuota"]
        if not (mes and 1 <= mes <= 12 and ano and ano > 1900):
            skip["periodo"] += 1; continue
        fp = clean_date(r["FechaPago"])
        rows.append((nid("cuotas", r["idCuotas"]), so, ti,
                     f"{ano:04d}-{mes:02d}-01", r["Monto"], fp,
                     fp is not None, None))
    n = copy(pg, "INSERT INTO cuotas (id,socio_id,tipo_cuota_id,periodo,monto,"
             "fecha_pago,pagada,metodo_pago_id) VALUES %s "
             "ON CONFLICT (id) DO NOTHING", rows)
    print(f"    cuotas origen={len(src)} insertadas={n} omit={skip}")
    return n


# ==========================================================================
# ACTIVIDADES / TURNOS
# ==========================================================================
def mig_actividades(my, pg):
    with my.cursor() as c:
        c.execute("SELECT * FROM Actividades")
        src = c.fetchall()
    rows = [(nid("actividades", r["idActividades"]),
             s(r["Descripcion"]) or f"Actividad {r['idActividades']}",
             None, r["Valor"], True) for r in src]
    return copy(pg, "INSERT INTO actividades (id,nombre,descripcion,"
                "monto_cuota,activa) VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_socios_actividades(my, pg):
    socio_ok, act_ok = ids(pg, "socios"), ids(pg, "actividades")
    with my.cursor() as c:
        c.execute("SELECT Actividades_idActividades a, Socios_NroSocio soc "
                  "FROM SociosEnActividades")
        src = c.fetchall()
    rows, seen = [], set()
    for r in src:
        so, ac = nid("socios", r["soc"]), nid("actividades", r["a"])
        if so not in socio_ok or ac not in act_ok or (so, ac) in seen:
            continue
        seen.add((so, ac))
        rows.append((nid("socios_actividades", f"{r['a']}:{r['soc']}"),
                     so, ac))
    return copy(pg, "INSERT INTO socios_actividades (id,socio_id,actividad_id) "
                "VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_instalaciones(my, pg):
    with my.cursor() as c:
        c.execute("SELECT idElementos, NombreElemento FROM Elementos")
        src = c.fetchall()
    rows, seen = [], set()
    for r in src:
        nom = s(r["NombreElemento"]) or f"Instalacion {r['idElementos']}"
        if nom in seen:
            nom = f"{nom} ({r['idElementos']})"
        seen.add(nom)
        rows.append((nid("instalaciones", r["idElementos"]), nom, None, True))
    return copy(pg, "INSERT INTO instalaciones (id,nombre,descripcion,activa) "
                "VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_turnos(my, pg):
    socio_ok, inst_ok = ids(pg, "socios"), ids(pg, "instalaciones")
    with my.cursor() as c:
        c.execute("SELECT idTurnos,Elementos_idElementos,CAST(Dia AS CHAR) Dia,"
                  "CAST(HoraInicio AS CHAR) hi,CAST(HoraFin AS CHAR) hf,"
                  "Socios_NroSocio soc FROM Turnos")
        src = c.fetchall()
    rows, skip = [], 0
    for r in src:
        if r["soc"] is None:            # turnos de clientes -> se omiten
            skip += 1; continue
        so, ins = nid("socios", r["soc"]), nid("instalaciones",
                                                r["Elementos_idElementos"])
        d = clean_date(r["Dia"])
        if so not in socio_ok or ins not in inst_ok or not d \
                or not r["hi"] or not r["hf"]:
            skip += 1; continue
        rows.append((nid("turnos", r["idTurnos"]), so, ins, d,
                     r["hi"], r["hf"], "confirmado"))
    n = copy(pg, "INSERT INTO turnos (id,socio_id,instalacion_id,fecha_turno,"
             "hora_inicio,hora_fin,estado) VALUES %s ON CONFLICT (id) DO NOTHING",
             rows)
    print(f"    turnos insertados={n} omitidos(cliente/invalidos)={skip}")
    return n


# ==========================================================================
# VENTAS / STOCK
# ==========================================================================
def mig_clientes(my, pg):
    with my.cursor() as c:
        c.execute("SELECT idClientes,Nombre,DNI FROM Clientes")
        src = c.fetchall()
    rows = [(nid("clientes", r["idClientes"]),
             s(r["Nombre"]) or "-", "-", s(r["DNI"]), None, None) for r in src]
    return copy(pg, "INSERT INTO clientes (id,apellido,nombre,dni,email,"
                "telefono) VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_items(my, pg):
    """ItemsVentas -> items_ventas (+ stock_items si DescuentaStock=1)."""
    with my.cursor() as c:
        c.execute("SELECT idItem,nombre,ValorSocio,DescuentaStock FROM ItemsVentas")
        src = c.fetchall()
    stock_rows, item_rows = [], []
    for r in src:
        nom = s(r["nombre"]) or f"Item {r['idItem']}"
        # El legacy no tenía columna `activo`: la baja de un ítem se marcaba
        # renombrándolo con "(DESUSO)" (o "No Usar"). Se traduce al flag real,
        # conservando el nombre porque las ventas históricas lo referencian.
        # Mantener los marcadores en sync con la migración
        # supabase/migrations/20260808000001_desactivar_items_desuso.sql, que
        # corrige las filas ya importadas (acá los INSERT son DO NOTHING).
        act = not any(k in nom.upper() for k in ("DESUSO", "NO USAR"))
        stk = None
        if r["DescuentaStock"]:
            stk = nid("stock_items", r["idItem"])
            stock_rows.append((stk, nom, None, "unidad", act))
        item_rows.append((nid("items_ventas", r["idItem"]), nom, None,
                          r["ValorSocio"] or 0, act, stk))
    copy(pg, "INSERT INTO stock_items (id,nombre,descripcion,unidad,activo) "
         "VALUES %s ON CONFLICT (id) DO NOTHING", stock_rows)
    n = copy(pg, "INSERT INTO items_ventas (id,nombre,descripcion,precio,activo,"
             "stock_item_id) VALUES %s ON CONFLICT (id) DO NOTHING", item_rows)
    print(f"    items_ventas={n} stock_items={len(stock_rows)}")
    return n


def mig_depositos(my, pg):
    with my.cursor() as c:
        c.execute("SELECT idDeposito,Nombre FROM Deposito")
        src = c.fetchall()
    rows, seen = [], set()
    for r in src:
        nom = s(r["Nombre"]) or f"Deposito {r['idDeposito']}"
        if nom in seen:
            nom = f"{nom} ({r['idDeposito']})"
        seen.add(nom)
        # Los "depósitos" legacy que no son almacén interno (Tiro Practico,
        # Secretaria, ...) son en realidad los sectores que venden al público
        low = nom.lower()
        tipo = "deposito" if ("deposito" in low or "depósito" in low) \
            else "punto_venta"
        rows.append((nid("depositos", r["idDeposito"]), nom, None, True, tipo))
    return copy(pg, "INSERT INTO depositos (id,nombre,descripcion,activo,tipo) "
                "VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def default_punto_venta(pg):
    """UUID del punto de venta al que caen las ventas legacy.

    VentasCabecera no tiene columna de sector, así que un default es la
    única opción. Si el legacy no trajo ningún punto de venta, se crea uno.
    """
    with pg.cursor() as cur:
        cur.execute("SELECT id FROM depositos WHERE tipo='punto_venta' "
                    "ORDER BY nombre LIMIT 1")
        row = cur.fetchone()
        if row:
            return row[0]
        pdv = nid("depositos", "__default_punto_venta__")
        cur.execute(
            "INSERT INTO depositos (id,nombre,descripcion,activo,tipo) "
            "VALUES (%s,%s,%s,true,'punto_venta') ON CONFLICT (id) DO NOTHING",
            (pdv, "Secretaria", "Punto de venta por defecto (migración)"))
        return pdv


def mig_stock_inventario(my, pg):
    stk_ok, dep_ok = ids(pg, "stock_items"), ids(pg, "depositos")
    with my.cursor() as c:
        c.execute("SELECT Deposito_idDeposito d,ItemsVentas_idItem i,Cantidad "
                  "FROM Stock")
        src = c.fetchall()
    rows, seen, skip = [], set(), 0
    for r in src:
        it, dp = nid("stock_items", r["i"]), nid("depositos", r["d"])
        if it not in stk_ok or dp not in dep_ok or (it, dp) in seen:
            skip += 1; continue
        seen.add((it, dp))
        rows.append((nid("stock_inventario", f"{r['i']}:{r['d']}"), it, dp,
                     r["Cantidad"] or 0))
    n = copy(pg, "INSERT INTO stock_inventario (id,item_id,deposito_id,cantidad) "
             "VALUES %s ON CONFLICT (id) DO NOTHING", rows)
    print(f"    stock_inventario={n} omit(sin stock_item)={skip}")
    return n


def mig_movimientos_stock(my, pg):
    stk_ok, dep_ok, u = ids(pg, "stock_items"), ids(pg, "depositos"), mig_user()
    with my.cursor() as c:
        c.execute("SELECT IdMovimientosStock id,CAST(Fecha AS CHAR) f,"
                  "ItemsVentas_idItem i,Cantidad,idDeposito_Origen o,"
                  "idDeposito_Destino d,Observaciones FROM MovimientosStock")
        src = c.fetchall()
    rows, skip = [], 0
    for r in src:
        it = nid("stock_items", r["i"])
        if it not in stk_ok:
            skip += 1; continue          # item sin control de stock
        cant = abs(r["Cantidad"] or 0)
        if cant == 0:
            skip += 1; continue
        o, d = r["o"], r["d"]
        dest = None
        if o and d and d != 0:
            tipo, dep = "transferencia", nid("depositos", o)
            dest = nid("depositos", d)
            if dest not in dep_ok:
                dest = None
        elif (r["Cantidad"] or 0) < 0:
            tipo, dep = "egreso", nid("depositos", d or o)
        else:
            tipo, dep = "ingreso", nid("depositos", d or o)
        if dep not in dep_ok:
            skip += 1; continue
        rows.append((nid("movimientos_stock", r["id"]), it, dep, tipo, cant,
                     s(r["Observaciones"]), u, clean_date(r["f"]), dest))
    n = copy(pg, "INSERT INTO movimientos_stock (id,item_id,deposito_id,tipo,"
             "cantidad,motivo,usuario_id,created_at,deposito_destino_id) "
             "VALUES %s ON CONFLICT (id) DO NOTHING", rows)
    print(f"    movimientos_stock={n} omit={skip}")
    return n


def mig_ventas(my, pg):
    socio_ok, cli_ok, u = ids(pg, "socios"), ids(pg, "clientes"), mig_user()
    pdv = default_punto_venta(pg)
    with my.cursor() as c:
        c.execute("SELECT idVentasCabecera id,CAST(Fecha AS CHAR) f,Total,"
                  "Socios_NroSocio soc,Clientes_idClientes cli FROM VentasCabecera")
        src = c.fetchall()
    rows = []
    for r in src:
        so = nid("socios", r["soc"]) if r["soc"] is not None else None
        so = so if so in socio_ok else None
        cl = nid("clientes", r["cli"]) if r["cli"] is not None else None
        cl = cl if cl in cli_ok else None
        fecha = clean_date(r["f"]) or "1900-01-01"
        rows.append((nid("ventas", r["id"]), cl, so, fecha, r["Total"] or 0,
                     None, u, False, pdv))
    n = copy(pg, "INSERT INTO ventas (id,cliente_id,socio_id,fecha,total,"
             "metodo_pago_id,usuario_id,anulada,punto_venta_id) VALUES %s "
             "ON CONFLICT (id) DO NOTHING", rows)
    print(f"    ventas={n}")
    return n


def mig_ventas_items(my, pg):
    venta_ok, item_ok = ids(pg, "ventas"), ids(pg, "items_ventas")
    with my.cursor() as c:
        c.execute("SELECT idVentasDetalles id,VentasCabecera_idVentasCabecera v,"
                  "ItemsVentas_idItem i,cantidad,Monto_Unidad,Monto_Total "
                  "FROM VentasDetalles")
        src = c.fetchall()
    rows, skip = [], 0
    for r in src:
        ve, it = nid("ventas", r["v"]), nid("items_ventas", r["i"])
        cant = r["cantidad"] or 0
        if ve not in venta_ok or it not in item_ok or cant <= 0:
            skip += 1; continue
        rows.append((nid("ventas_items", r["id"]), ve, it, cant,
                     r["Monto_Unidad"] or 0, r["Monto_Total"] or 0))
    n = copy(pg, "INSERT INTO ventas_items (id,venta_id,item_id,cantidad,"
             "precio_unitario,subtotal) VALUES %s ON CONFLICT (id) DO NOTHING",
             rows)
    print(f"    ventas_items={n} omit={skip}")
    return n


# ==========================================================================
# TESORERÍA
# ==========================================================================
def mig_cajas(my, pg):
    with my.cursor() as c:
        c.execute("SELECT id,nombre,saldo FROM cajas")
        src = c.fetchall()
    rows, seen = [], set()
    for r in src:
        nom = s(r["nombre"]) or f"Caja {r['id']}"
        if nom in seen:
            nom = f"{nom} ({r['id']})"
        seen.add(nom)
        rows.append((nid("cajas", r["id"]), nom, None, r["saldo"] or 0, True))
    return copy(pg, "INSERT INTO cajas (id,nombre,descripcion,saldo_inicial,"
                "activa) VALUES %s ON CONFLICT (id) DO NOTHING", rows)


def mig_categorias_movimientos(my, pg):
    with my.cursor() as c:
        c.execute("SELECT id,tipo,nombre FROM categorias")
        src = c.fetchall()
    rows, canon = [], {}   # (nombre,tipo_new) -> uuid canónico
    # fallback primero
    rows.append((CAT_FALLBACK_ING, "Sin categoría (migración)", "ingreso", True))
    rows.append((CAT_FALLBACK_EGR, "Sin categoría (migración)", "egreso", True))
    for r in src:
        tipo = "ingreso" if (r["tipo"] or "").upper() == "E" else "egreso"
        nom = s(r["nombre"]) or f"Cat {r['id']}"
        key = (nom, tipo)
        cid = nid("categorias_movimientos", r["id"])
        if key not in canon:
            canon[key] = cid
            rows.append((cid, nom, tipo, True))
        # si (nombre,tipo) ya existe, la FK del movimiento se remapea vía _cat_uuid
    n = copy(pg, "INSERT INTO categorias_movimientos (id,nombre,tipo,activa) "
             "VALUES %s ON CONFLICT (id) DO NOTHING", rows)
    print(f"    categorias_movimientos={n} (incluye 2 fallback)")
    return n


def _cat_uuid(pg, legacy_id, tipo_new):
    """uuid de categoria_movimientos para un movimiento; fallback si no existe."""
    if legacy_id is not None:
        cid = nid("categorias_movimientos", legacy_id)
        return cid
    return CAT_FALLBACK_ING if tipo_new == "ingreso" else CAT_FALLBACK_EGR


def mig_movimientos_fondos(my, pg):
    caja_ok, cat_ok, u = ids(pg, "cajas"), ids(pg, "categorias_movimientos"), mig_user()
    with my.cursor() as c:
        c.execute("SELECT id,caja_id,categoria_id,CAST(fecha AS CHAR) f,detalle,"
                  "importe,tipo FROM movimientos")
        src = c.fetchall()
    rows, skip = [], {"caja": 0, "monto0": 0}
    for r in src:
        caja = nid("cajas", r["caja_id"])
        if caja not in caja_ok:
            skip["caja"] += 1; continue
        monto = abs(float(r["importe"] or 0))
        if monto == 0:
            skip["monto0"] += 1; continue
        tipo = "ingreso" if (r["tipo"] or "").upper() == "E" else "egreso"
        cat = _cat_uuid(pg, r["categoria_id"], tipo)
        if cat not in cat_ok:            # categoria legacy que se dedupeó
            cat = CAT_FALLBACK_ING if tipo == "ingreso" else CAT_FALLBACK_EGR
        rows.append((nid("movimientos_fondos", r["id"]), caja, cat, tipo, monto,
                     s(r["detalle"]), clean_date(r["f"]) or "1900-01-01", u))
    n = copy(pg, "INSERT INTO movimientos_fondos (id,caja_id,categoria_id,tipo,"
             "monto,descripcion,fecha,usuario_id) VALUES %s "
             "ON CONFLICT (id) DO NOTHING", rows)
    print(f"    movimientos_fondos={n} omit={skip}")
    return n


# ==========================================================================
STAGES = {
    "categorias_sociales": mig_categorias_sociales,
    "metodos_cobranza": mig_metodos_cobranza,
    "tipos_cuotas": mig_tipos_cuotas,
    "socios": mig_socios,
    "grupos_familiares": mig_grupos_familiares,
    "cuotas": mig_cuotas,
    "actividades": mig_actividades,
    "socios_actividades": mig_socios_actividades,
    "instalaciones": mig_instalaciones,
    "turnos": mig_turnos,
    "clientes": mig_clientes,
    "items": mig_items,
    "depositos": mig_depositos,
    "stock_inventario": mig_stock_inventario,
    "movimientos_stock": mig_movimientos_stock,
    "ventas": mig_ventas,
    "ventas_items": mig_ventas_items,
    "cajas": mig_cajas,
    "categorias_movimientos": mig_categorias_movimientos,
    "movimientos_fondos": mig_movimientos_fondos,
}
ORDER = list(STAGES.keys())
POC = ["categorias_sociales", "metodos_cobranza", "socios"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stages", default="poc",
                    help="'poc', 'all', o lista separada por comas")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.stages == "poc":
        stages = POC
    elif args.stages == "all":
        stages = ORDER
    else:
        stages = [x.strip() for x in args.stages.split(",")]

    my, pg = connect_source(), connect_target()
    with pg.cursor() as cur:  # evita cortes del pooler en la transacción larga
        cur.execute("SET statement_timeout=0; "
                    "SET idle_in_transaction_session_timeout=0;")
    print(f"Fases: {stages}  dry_run={args.dry_run}")
    total = 0
    try:
        for name in stages:
            fn = STAGES.get(name)
            if not fn:
                print(f"  ! fase desconocida: {name}"); continue
            n = fn(my, pg)
            total += n
            print(f"  [{name}] +{n}")
        if args.dry_run:
            pg.rollback(); print("DRY-RUN: rollback (nada persistido)")
        else:
            pg.commit(); print("COMMIT ok")
    except Exception:
        pg.rollback(); raise
    finally:
        my.close(); pg.close()
    print(f"Total filas: {total}")


if __name__ == "__main__":
    main()
