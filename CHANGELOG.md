# CHANGELOG — ATGQ ERP

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versiones según [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Added

- **P1.2** — Configuración Supabase CLI local + clientes server/browser:
  - `@supabase/supabase-js` y `@supabase/ssr` instalados
  - `supabase init` ejecutado (`supabase/config.toml`)
  - `.env.example` con template de variables, `.env.local` con keys default de desarrollo
  - Cliente browser (`src/lib/supabase/client.ts`) con `createBrowserClient`
  - Cliente server (`src/lib/supabase/server.ts`) con `createServerClient` + cookies sync (Next.js 14)
  - Middleware helper (`src/lib/supabase/middleware.ts`) con `updateSession` usando `getUser()`
  - Next.js middleware (`src/middleware.ts`) con matcher que excluye assets estáticos

- **P1.1** — Scaffold inicial del proyecto:
  - Next.js 14.2.35 con App Router, TypeScript strict, Tailwind CSS v3
  - shadcn/ui configurado (components.json, CSS variables, `cn()` utility)
  - Dependencias: @tanstack/react-table, react-hook-form, zod, recharts, date-fns, lucide-react
  - Prettier + eslint-config-prettier con scripts `format` y `format:check`
  - Estructura de carpetas: `src/app/`, `src/components/ui/`, `src/components/shared/`, `src/lib/`, `src/types/`

---

## [0.1.0] — 2026-03-14

### Added

- `docs/PRD.md` — Documento de requerimientos del producto completo con:
  - Descripción de los 7 módulos del sistema (SOCIOS, ACTIVIDADES, TURNOS, VENTAS, STOCK, TESORERÍA, Security)
  - Especificación del stack tecnológico (Next.js 14, shadcn/ui, Supabase)
  - Esquemas SQL para todas las tablas del sistema
  - Criterios de aceptación por módulo
  - Notas de migración, localización argentina y consideraciones de negocio

- `plan/PROMPT_PLAN.md` — Plan de implementación con 33 prompts accionables:
  - 9 fases de desarrollo ordenadas por prioridad
  - Cada tarea con ID, dependencias, prompt completo, archivos esperados y criterio de verificación
  - Cubre: scaffold, auth, layout, todos los módulos, reportes, exportación y RBAC

- `PROGRESS.md` — Tablero de seguimiento de avance:
  - Tabla de estado global por fase
  - Checklist detallado por tarea (33 items)
  - Sección de bloqueadores activos

- `CHANGELOG.md` — Este archivo

- `docs/screenshots/` — Capturas del sistema legacy de referencia:
  - `socios.jpg` — Menú módulo SOCIOS con dropdown completo
  - `sociostabla.jpg` — Vista tabla Administración de Socios (8.444 registros)
  - `actividades.jpg` — Menú módulo ACTIVIDADES
  - `stock.jpg` — Inventario agrupado por depósito + menú STOCK
  - `ventas.jpg` — Menú módulo VENTAS
  - `tesoreria.jpg` — Menú módulo TESORERÍA

---

<!-- Template para próximas versiones:

## [0.2.0] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

-->

[Unreleased]: https://github.com/usuario/atgq-erp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/usuario/atgq-erp/releases/tag/v0.1.0
