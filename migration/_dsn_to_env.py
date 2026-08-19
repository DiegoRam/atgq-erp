#!/usr/bin/env python3
"""Convierte un DSN de Postgres en exports de variables PG*, para `eval`.

POR QUÉ EXISTE ESTE ARCHIVO, Y NO ES UN HEREDOC ADENTRO DE run_real.sh
---------------------------------------------------------------------
`psql "$PG_DSN"` deja la password de producción en argv, y cualquier usuario de
la máquina la lee con `ps`. Las variables PG* sólo las ve el mismo usuario, así
que el script parte el DSN y llama a psql sin argumentos de conexión.

La versión anterior hacía eso con un heredoc de python adentro de
`eval "$(python3 - "$DSN" <<'PY' ... PY)"`. **No funciona en bash 3.2**, que es
el bash que trae macOS: su parser no maneja bien un heredoc dentro de una
sustitución de comando dentro de comillas dobles, y con paréntesis en el cuerpo
cierra la sustitución antes de tiempo. El síntoma es engañoso:

    run_real.sh: eval: line 115: syntax error near unexpected token `('

que apunta a una línea que no tiene nada malo. Pasó en la corrida del
2026-08-18: el script murió antes del preflight (sin tocar producción, porque
esto corre en la etapa de configuración).

Uso:
    eval "$(python3 migration/_dsn_to_env.py "$PG_DSN")"
"""
import sys
import urllib.parse as u


def sh(v):
    """Cita para shell: envuelve en comillas simples y escapa las internas."""
    return "'" + str(v).replace("'", "'\\''") + "'"


def main():
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        sys.stderr.write("uso: _dsn_to_env.py <postgresql://...>\n")
        return 2

    p = u.urlparse(sys.argv[1].strip())
    if p.scheme not in ("postgres", "postgresql"):
        sys.stderr.write(
            "DSN invalido: se esperaba postgresql://... y vino '%s'\n" % p.scheme)
        return 2
    if not p.hostname:
        sys.stderr.write("DSN invalido: no tiene host\n")
        return 2

    q = dict(u.parse_qsl(p.query))
    salida = [
        ("PGHOST", p.hostname),
        ("PGPORT", p.port or 5432),
        ("PGUSER", u.unquote(p.username or "")),
        ("PGPASSWORD", u.unquote(p.password or "")),
        ("PGDATABASE", (p.path or "/postgres").lstrip("/") or "postgres"),
        ("PGSSLMODE", q.get("sslmode", "require")),
    ]
    for k, v in salida:
        print("export %s=%s" % (k, sh(v)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
