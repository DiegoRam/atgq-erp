# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATGQ-ERP is an ERP system for the **Asociación de Tiro y Gimnasia de Quilmes** (ATGQ), a shooting-range and gymnastics club in Argentina (~8,400 members). It replaces the legacy "Sistema de Socios y Control Administrativo" previously running at `atygq.sociosonline.ar`.

**Project status: fully implemented.** All 9 phases / 33 tasks (P1.1–P9.3) in `plan/PROMPT_PLAN.md` are complete (see `PROGRESS.md`). CHANGELOG entries are still grouped under `[Unreleased]` (version 0.1.0). The `docs/screenshots/` directory holds reference screenshots of the legacy system.

The app is deployed on **Vercel** (frontend) with **Supabase Cloud** (Postgres + Auth). Supabase project refs: main `gcnytasaepgsfqvdyrth`, develop `cosadbrfepoyoxmwwoht`.

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
npx supabase db push --project-ref <ref>   # apply migrations (run from repo root)
```

Never run `supabase db reset` — apply migrations to preserve auth users.

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
