# ATGQ-ERP

ERP system for the **Asociación de Tiro y Gimnasia de Quilmes** (ATGQ), a shooting-range and gymnastics club in Argentina (~8,400 members). It replaces the legacy "Sistema de Socios y Control Administrativo" that ran at `atygq.sociosonline.ar`.

The UI and domain language is **Spanish** (currency ARS, dates DD/MM/YYYY, timezone America/Argentina/Buenos_Aires); this README is in English for developers.

## Modules

| Module | Features |
|--------|----------|
| **SOCIOS** (Members) | Member CRUD (auto member number, unique DNI, categories), Family Groups, Delinquent Members, Dues (record payment + mass generation), Roster (Padrón), reports by Category/Age/Locality/Monthly dues, and config for Social Categories, Dues Types and Collection Methods. |
| **ACTIVIDADES** (Activities) | Activity CRUD with enrollee detail, member enroll/unenroll, activity-dues generation and Extra Activities. |
| **TURNOS** (Bookings) | Facility booking management with time-overlap validation. |
| **VENTAS** (Sales) | New Sale (POS with cart and stock decrement), Completed Sales (void/anulación), Customers, Sale Items, monthly/daily/per-item reports and charts. |
| **STOCK** | Inventory per warehouse (with negative-stock alerts), Ins/Outs, Movements, Warehouse and Item CRUD. |
| **TESORERÍA** (Treasury) | Cash boxes (computed balance), Fund Movements, Transfers between boxes, Movement Categories and reports (summary, concept-by-date, charts). |
| **Security** | User management (Supabase Admin API), roles and a permission matrix (7 modules × read/write/delete), RLS policies. |

## Stack

- **[Next.js 14](https://nextjs.org/)** (App Router) · React 18 · TypeScript (strict)
- **[Supabase](https://supabase.com/)** (PostgreSQL + Auth) via `@supabase/ssr`
- **[Tailwind CSS](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** (Radix)
- **[TanStack Table](https://tanstack.com/table)** · **[react-hook-form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)**
- **[Zustand](https://zustand-demo.pmnd.rs/)** (workspace tabs) · **[Recharts](https://recharts.org/)** · **[SheetJS/xlsx](https://sheetjs.com/)** (Excel export) · **[date-fns](https://date-fns.org/)** (`es-AR`)

## Requirements

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development with Docker)

## Getting started (local)

```bash
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres + Auth)
supabase start

# 3. Apply migrations and seed data
supabase db reset   # local only; NEVER against a remote project (wipes auth users)

# 4. Configure environment variables
cp .env.example .env.local
# Fill in the values from `supabase status`

# 5. Run the dev server
npm run dev
```

The app is available at http://localhost:3000.

> **First-user bootstrap:** create a user in Supabase Auth. The first account is automatically assigned the **Administrador** role; while `usuarios_roles` is empty the layout grants full access so you can't get locked out.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (anon) key — browser/server client under RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **bypasses RLS**, server-side only (Security module, permission lookups). Never expose to the client. |

## Scripts

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # serve the production build
npm run lint           # next lint
npm run format         # prettier --write .
npm run format:check   # prettier --check .
```

## Database

The schema lives in `supabase/migrations/` (25 tables across the 7 modules, with RLS enabled). To apply migrations to a remote project:

```bash
npx supabase db push --project-ref <ref>
```

> ⚠️ **Never** run `supabase db reset` against a remote project — it wipes the `auth` users. Always use `db push` to preserve them.

**Access control (RBAC):** `roles` → `permisos_modulo` (read/write/delete per module) → `usuarios_roles`. Enforced both in the database (RLS policies via the `get_user_modulo_permission()` function) and in the application layer (`src/lib/permissions.ts`). Base roles:

| Role | Access |
|------|--------|
| **Administrador** | Full access to all 7 modules |
| **Tesorero** | Write on treasury/sales/stock; members read-only |
| **Recepcionista** | Write on members/bookings; sales read; rest read |
| **Solo Lectura** | Read-only across all modules |

## Project structure

```
src/
├── app/
│   ├── (dashboard)/       # module routes: colocated page.tsx + actions.ts
│   ├── login/             # authentication
│   └── layout.tsx         # root layout
├── components/
│   ├── ui/                # shadcn/ui primitives
│   ├── shared/            # DataTable, FormModal, ReportLayout, StatsCard, WorkspaceTabs, ...
│   └── <module>/          # per-module forms
├── lib/
│   ├── supabase/          # server / client / admin clients + middleware
│   ├── schemas/           # Zod schemas
│   ├── permissions.ts     # RBAC helpers
│   ├── nav-config.ts      # menu definition
│   └── format.ts, export.ts
├── types/, hooks/, store/ # types, hooks, Zustand stores
└── middleware.ts          # auth guard

supabase/migrations/       # SQL schema, RLS policies, seed data
docs/                      # PRD.md + legacy-system screenshots
plan/PROMPT_PLAN.md        # implementation plan (9 phases / 33 tasks)
```

## Architecture

- **Route-colocated server actions.** Every folder under `src/app/(dashboard)/<module>/` has `page.tsx` + `actions.ts` (`"use server"`). There are no API routes; data access lives in the actions.
- **Three Supabase clients** (`src/lib/supabase/`): `server.ts` (cookie-bound, RLS as the user), `client.ts` (browser), and `admin.ts` (service-role, bypasses RLS — used by the Security module and permission lookups).
- **Auth guard** in `src/middleware.ts`: no session → `/login`.
- **Tabbed navigation** (Zustand + sessionStorage, max 8 tabs), filtered by the user's read permissions, responsive (dropdowns on desktop, side sheet on mobile).

## Deployment

- **Frontend:** Vercel.
- **Database / Auth:** Supabase Cloud.

Set the three environment variables in the provider and apply migrations with `supabase db push` before the first deploy.

## Status

Implementation complete: all 9 phases / 33 tasks in `plan/PROMPT_PLAN.md` are finished. See `PROGRESS.md` and `CHANGELOG.md` for details.
