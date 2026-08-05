# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATGQ-ERP is an ERP system for the **Asociación de Tiro y Gimnasia de Quilmes** (ATGQ), a shooting-range and gymnastics club in Argentina (~8,400 members). It replaces the legacy "Sistema de Socios y Control Administrativo" previously running at `atygq.sociosonline.ar`.

**Project status: fully implemented.** All 9 phases / 33 tasks (P1.1–P9.3) in `plan/PROMPT_PLAN.md` are complete (see `PROGRESS.md`). CHANGELOG entries are still grouped under `[Unreleased]` (version 0.1.0). The `docs/screenshots/` directory holds reference screenshots of the legacy system.

The app is deployed on **Vercel** (frontend) with **Supabase Cloud** (Postgres + Auth). Active/linked Supabase project ref: `qtlfabajjvhyluqkvike` (`atygq_erp`, us-east-1) — this replaced the earlier database that was deleted. Legacy refs (no longer used): main `gcnytasaepgsfqvdyrth`, develop `cosadbrfepoyoxmwwoht`.

## Tech Stack

- **Next.js 14.2** (App Router) · React 18 · TypeScript (strict)
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) — components in `src/components/ui/`
- **@tanstack/react-table** (DataTable) · **react-hook-form** + **Zod v4** (forms/validation)
- **Zustand** (workspace tabs) · **Recharts** (charts) · **xlsx** (Excel export) · **date-fns** (`es-AR`)
- UI/domain language is **Spanish**; currency **ARS**; dates **DD/MM/YYYY**; TZ America/Argentina/Buenos_Aires

## Commands

```bash
npm run dev            # next dev
npm run build          # next build (verify this passes before completing a task)
npm run lint           # next lint
npm run format         # prettier --write .
supabase db push       # apply migrations to linked project (run from repo root)
```

**Supabase CLI**: use the globally-installed `supabase` binary (`/usr/local/bin/supabase`) directly — **never `npx supabase`** (avoids a per-run download and uses the pinned global version). The CLI is already linked to the active project (ref stored in `supabase/.temp/project-ref`), so `db push` / `db pull` need no `--project-ref` flag.

Never run `supabase db reset` — apply migrations to preserve auth users.

## Verifying a change

A task is not done when it compiles. Run these in order, and report what actually happened (including failures):

1. **`npm run build`** and **`npm run lint`** must pass clean.
2. **SQL against a real database.** Migrations and RPCs must be applied and exercised, never just eyeballed — plpgsql bodies hide errors that only surface at runtime. A local Supabase stack (`supabase_db_atgq-erp`, port `54322`) is the sandbox; reach it with the `libpq` psql at `/usr/local/opt/libpq/bin/psql` using `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Simulate a user with `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` to test `auth.uid()` and RLS. Verify invariants (totals, balances), error paths, and that failures roll back leaving no rows. **Restore the local DB to its prior state afterwards** — it is the developer's working sandbox, not a scratch DB.
3. **Code review — obligatorio para todo cambio Tier 2+** (multi-archivo, lógica de negocio, o feature nueva). Correr la skill `code-review` sobre el diff, antes de tocar el browser. No es opcional ni "si da el tiempo": es el paso que encuentra los errores que el build no ve, porque compilar sólo prueba que los tipos cierran. En la duda de si un cambio califica, correrla igual.
   - **La skill está escrita para PRs de GitHub.** Cuando no hay PR (lo habitual acá: se trabaja sobre el diff de la rama), adaptarla: correr los agentes de revisión contra `git diff` y **reportar los hallazgos en la conversación** en vez de comentar con `gh`.
   - **Los archivos nuevos sin trackear no aparecen en `git diff`.** Hay que nombrárselos explícitamente a los revisores para que los lean, o quedan sin revisar — que suele ser justo donde está el código nuevo.
   - **Los hallazgos se verifican antes de aplicarlos.** Los revisores se equivocan y también aciertan por las razones equivocadas; rehacer la cuenta o leer el código antes de cambiar nada. Los que sobreviven se arreglan *antes* de dar la tarea por terminada, y se vuelve a correr build/lint/tsc después.
   - Conviene lanzar revisores con foco distinto (adherencia a este CLAUDE.md, bugs del diff, y una dimensión propia del cambio) en vez de uno genérico.
4. **`agent-browser`** — verify the UI end to end for any Tier 2+ change (multi-file, business logic, or a new feature): walk the real screens, exercise the new flows, and confirm the data actually changed. Save screenshots to `tests/screenshots/`. Type-correct code that renders a broken screen is still a broken change; the browser pass is what catches it.

Do not start a dev server just to test. If one is already running, use it; if the app is unreachable, say so and stop rather than launching one.

## Architecture

- **Route-colocated server actions.** Every route folder under `src/app/(dashboard)/<module>/` has `page.tsx` + `actions.ts` (`"use server"`). There are no API routes; data access lives in server actions. Pages are mostly `"use client"` and call actions as RPCs (useState/useEffect/useCallback); the dashboard home and layouts are RSC exceptions.
- **Three Supabase clients** (`src/lib/supabase/`): `server.ts` `createClient()` (cookie-bound, RLS as the user — called synchronously, not awaited), `client.ts` (browser), `admin.ts` `createAdminClient()` (service-role, **bypasses RLS** — used for permission/count lookups and the entire Security module).
- **Auth guard** in `src/middleware.ts` → `updateSession` (unauthenticated → `/login`; wrapped in try/catch so middleware failure never hard-blocks). `(dashboard)/layout.tsx` loads permissions server-side and shows "Sin rol asignado" for role-less users; when `usuarios_roles` is empty it runs in **bootstrap mode** (first user gets full nav).
- **RBAC**: `roles` → `permisos_modulo` (per-module `puede_leer`/`escribir`/`eliminar`) → `usuarios_roles`. 7 module keys: `socios, actividades, turnos, ventas, stock, tesoreria, seguridad`. Enforced two ways — DB RLS via `get_user_modulo_permission()` (SECURITY DEFINER, migration `…000009`) and app-layer `src/lib/permissions.ts` (`getUserPermissions`, `hasPermission`, `isAdmin` — name-based on "Administrador", most-permissive merge across roles). Base roles: **Administrador, Tesorero, Recepcionista, Solo Lectura**.
- **Shared primitives** (`src/components/shared/`): `DataTable` (TanStack, manual/server pagination + sorting — parent owns page/pageSize/query state), `FormModal` (Radix Dialog wrapper, parent owns form state), `PageHeader`, `ReportLayout` (report pages), `StatsCard` (KPIs), `FacetFilter` (checkbox sidebar), `RecaudacionChart`, `WorkspaceTabs`. The `index.ts` barrel only exports DataTable/FacetFilter/FormModal/PageHeader/StatsCard/WorkspaceTabs — import the others by path.
- **Navigation**: modules are declared in `src/lib/nav-config.ts` (`NAV_MODULES`, each with a `modulo` key matching RBAC). The navbar filters by `puede_leer` and is responsive (desktop dropdowns / mobile Sheet hamburger at the `md` breakpoint). Open routes via `useTabsStore().openTab(href, label)` then `router.push(href)` — the workspace-tab system (Zustand, sessionStorage key `atgq-erp-tabs`, `MAX_TABS = 8`, tab id === href).
- **Utils**: `@/lib/format` (`formatCurrency` ARS, `formatDate`, `formatAntiguedad` — computed, never stored), `@/lib/export` (Excel via dynamic `xlsx` import), `cn()` from `@/lib/utils`.

## Database

Schema lives in `supabase/migrations/` (25 tables across the 7 modules). Key migrations: `…000001_initial_schema` (all tables + RLS enabled), `…000003_socios_helpers` (report RPCs `get_socios_*`), `…000009_rbac_rls_policies` (per-operation RBAC policies replacing the earlier permissive ones), plus per-module seed migrations and admin bootstrap (`…000008`, `20260403000001_seed_admin_role`). SOCIOS reports use Postgres RPCs; most other reports aggregate in application code.

### Recrear una base desde cero (seed reproducible)

Datos de prueba en **tres archivos, en este orden** (declarado en `config.toml [db.seed] sql_paths`):
1. `supabase/seeds/dev_user.sql` — crea el usuario Auth `diego@diegoram.me` / `12345678` (vía `crypt()`, email confirmado) y le asigna rol Administrador. **Debe correr primero**: `seed.sql` inserta `movimientos_fondos` que requieren un usuario en `auth.users`.
2. `supabase/seed.sql` — seed core: 14 categorías sociales, métodos/tipos de cuota, 4 roles + permisos, 50 socios, grupos, ~111 cuotas, cajas, categorías e ~27 movimientos de tesorería, instalaciones. Auto-suficiente e idempotente (`ON CONFLICT DO NOTHING`).
3. `supabase/seeds/demo_bonus.sql` — datos demo de ventas/stock/turnos. Agrega **socios puente 1001–1005** (los seeds de módulo `…04–07` los buscan por `nro_socio` pero `seed.sql` numera 1–50) y corre los bloques `DO` de movimientos de stock, ventas e inscripciones/turnos, con guards de idempotencia.

**Aplicar a un proyecto remoto nuevo** (el CLI no tiene `db execute`; los `[db.seed]` solo corren en `db reset` local, que no usamos):
```bash
supabase db push                       # esquema + RLS + seeds estáticos de módulo
# luego correr los 3 seeds en orden contra el remoto, p.ej. con psql:
psql "$DATABASE_URL" -f supabase/seeds/dev_user.sql
psql "$DATABASE_URL" -f supabase/seed.sql
psql "$DATABASE_URL" -f supabase/seeds/demo_bonus.sql
```
Si no hay `psql`/DB password a mano, envolver cada archivo como una migración temporal `supabase/migrations/<ts>_*.sql`, hacer `supabase db push`, y luego limpiar el ledger con `supabase migration repair --status reverted <ts>` (no borra datos, solo el registro). Así se sembró `qtlfabajjvhyluqkvike` el 2026-07-23.

## Conventions

- Match the surrounding code: server components fetch, `"use server"` actions are colocated as `actions.ts`, forms use react-hook-form + `zodResolver` + `sonner` toasts, Spanish UI copy, `cn()` for classes, lucide-react icons.
- Task IDs (P1.1…P9.3) appear in commit messages; update `PROGRESS.md` and `CHANGELOG.md` when completing plan tasks.
- Known systemic tech-debt (authz gaps in module actions, no server-side Zod validation, non-atomic multi-writes, the "Todos" filter-Select bug, duplicate-cuota generation, hardcoded name lookups, `next-themes` not wired) is catalogued in the agent memory notes — check current code before asserting any specific instance.

## Legacy System Modules (reference, from screenshots)

The system replicates and improves on the legacy "Sistema de Socios y Control Administrativo":

- **SOCIOS** — Member management (~8,400 members). Categories: Activo, Inactivo, Cadete, Vitalicio, Adherente, Honorario, Grupo Familiar, "Ventanilla" variants. Tracks Nro Socio, Apellido, Nombre, DNI, Categoría, Fecha Alta/Baja, Antigüedad, Pagas/Impagas, Cobranza method. Sub-features: Grupos Familiares, Socios Morosos, Cuotas, Padrón, reports by Categoría/Edad/Localidad, Categorías Sociales, Tipo de Cuotas, Cobranzas.
- **ACTIVIDADES** — Administración de Actividades, Generar Cuota de Actividades, Actividades Extras.
- **TURNOS** — Shift/booking management (with overlap validation).
- **VENTAS** — Nueva Venta (POS), Ventas Realizadas, Clientes, Items de Ventas. Reports: Sumarizadas Mensual/Diaria, Venta de Item/periodo, Gráfico de Ventas, Gráfico de Items.
- **STOCK** — Inventario (~160 items across depósitos), Ingresos/Egresos, Movimientos de Stock, Depósitos. Items include shooting targets (blancos), ammunition (cartuchos), and supplies.
- **TESORERÍA** — Cajas, Ingresar Movimiento, Movimientos de Fondos, Transferencias entre cajas. Reports: Sumarización de Conceptos, Concepto entre fechas, Gráfico de Movimientos/Salidas, Categorías movimientos.
- **Security** — User/role/permission management.

## Directory Structure

- `src/app/(dashboard)/` — module routes (page + colocated `actions.ts`)
- `src/components/` — `ui/` (shadcn), `shared/` (primitives), per-module form components
- `src/lib/` — `supabase/` clients, `schemas/` (Zod), `permissions.ts`, `nav-config.ts`, `format.ts`, `export.ts`
- `src/types/`, `src/hooks/`, `src/store/` — types, hooks, Zustand stores
- `supabase/migrations/` — SQL schema, RLS policies, seed data
- `docs/PRD.md` — Product Requirements Document · `docs/screenshots/` — legacy reference
- `plan/PROMPT_PLAN.md` — 9-phase / 33-task implementation plan
- `PROGRESS.md` — task tracking board · `CHANGELOG.md` — change history (Keep-a-Changelog)
