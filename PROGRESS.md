# PROGRESS — ATGQ ERP

**Inicio:** 2026-03-14
**Versión actual:** 0.1.0 (Documentación inicial)
**Stack:** Next.js 14 · TypeScript · shadcn/ui · Supabase (CLI local)
**Referencia de tareas:** `plan/PROMPT_PLAN.md`

---

## Estado global

| Fase | Nombre | Estado | Completado |
|------|--------|--------|------------|
| 1 | Scaffold + Base de datos | ✅ Completado | 4/4 |
| 2 | Auth + Layout | ⬜ Pendiente | — |
| 3 | SOCIOS | ⬜ Pendiente | — |
| 4 | TESORERÍA | ⬜ Pendiente | — |
| 5 | STOCK | ⬜ Pendiente | — |
| 6 | VENTAS | ⬜ Pendiente | — |
| 7 | ACTIVIDADES + TURNOS | ⬜ Pendiente | — |
| 8 | Reportes avanzados | ⬜ Pendiente | — |
| 9 | Security / RBAC | ⬜ Pendiente | — |

**Leyenda:** ⬜ Pendiente · 🔄 En progreso · ✅ Completado

---

## FASE 1 — Scaffold + Base de datos

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P1.1 | Inicializar proyecto Next.js 14 + TypeScript + Tailwind + shadcn/ui | ✅ | 2026-03-14 |
| P1.2 | Configurar Supabase CLI local + clientes server/browser | ✅ | 2026-03-14 |
| P1.3 | Crear migraciones SQL completas (schema completo) | ✅ | 2026-03-14 |
| P1.4 | Seed data inicial (categorías, roles, depósito, etc.) | ✅ | 2026-03-14 |

---

## FASE 2 — Auth + Layout

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P2.1 | Login/logout con Supabase Auth + middleware de protección | ⬜ | — |
| P2.2 | Layout principal: header + navbar con dropdowns | ⬜ | — |
| P2.3 | Sistema de tabs del workspace (ModuleTab) | ⬜ | — |
| P2.4 | Componentes base: DataTable, FacetFilter, FormModal, StatsCard | ⬜ | — |

---

## FASE 3 — Módulo SOCIOS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P3.1 | Tabla de socios con paginación server-side + sidebar filtros | ⬜ | — |
| P3.2 | Formulario alta/edición de socio | ⬜ | — |
| P3.3 | Vista grupos familiares | ⬜ | — |
| P3.4 | Vista socios morosos | ⬜ | — |
| P3.5 | Gestión de cuotas (ver, pagar, generar masivo) | ⬜ | — |
| P3.6 | Padrón exportable | ⬜ | — |
| P3.7 | Reportes: por categoría, edad, localidad, cuotas mensuales | ⬜ | — |

---

## FASE 4 — Módulo TESORERÍA

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P4.1 | ABM Cajas (con saldo calculado) | ⬜ | — |
| P4.2 | Formulario Ingresar Movimiento | ⬜ | — |
| P4.3 | Historial Movimientos de Fondos con filtros | ⬜ | — |
| P4.4 | Transferencias entre cajas | ⬜ | — |
| P4.5 | Config: Categorías de movimientos | ⬜ | — |
| P4.6 | Reportes: sumarización, concepto entre fechas, gráficos | ⬜ | — |

---

## FASE 5 — Módulo STOCK

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P5.1 | Inventario agrupado por depósito (con alertas stock negativo) | ⬜ | — |
| P5.2 | Formulario Ingresos/Egresos de stock | ⬜ | — |
| P5.3 | Historial movimientos de stock | ⬜ | — |
| P5.4 | ABM Depósitos | ⬜ | — |
| P5.5 | ABM Ítems de stock | ⬜ | — |

---

## FASE 6 — Módulo VENTAS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P6.1 | Formulario Nueva Venta (POS) | ⬜ | — |
| P6.2 | Historial Ventas Realizadas | ⬜ | — |
| P6.3 | ABM Clientes | ⬜ | — |
| P6.4 | ABM Ítems de ventas | ⬜ | — |
| P6.5 | Reportes: mensual, diaria, por ítem | ⬜ | — |
| P6.6 | Gráficos de ventas e ítems | ⬜ | — |

---

## FASE 7 — Módulo ACTIVIDADES + TURNOS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P7.1 | ABM Actividades + detalle con inscriptos | ⬜ | — |
| P7.2 | Inscripción/baja de socios en actividades | ⬜ | — |
| P7.3 | Generar cuota masiva de actividades | ⬜ | — |
| P7.4 | ABM Actividades Extras | ⬜ | — |
| P7.5 | Gestión de Turnos (CRUD + validación solapamiento) | ⬜ | — |

---

## FASE 8 — Reportes avanzados

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P8.1 | Dashboard home con KPIs | ⬜ | — |
| P8.2 | Exportación Excel (xlsx) en reportes principales | ⬜ | — |
| P8.3 | Config SOCIOS: categorías sociales, tipos cuotas, cobranzas | ⬜ | — |

---

## FASE 9 — Security / RBAC

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P9.1 | ABM usuarios del sistema (Supabase Admin API) | ⬜ | — |
| P9.2 | ABM roles y permisos por módulo | ⬜ | — |
| P9.3 | Supabase RLS policies en todas las tablas | ⬜ | — |

---

## Bloqueadores activos

_Ninguno por ahora._

---

## Notas de implementación

- Para marcar una tarea: cambiar ⬜ por 🔄 al empezar, ✅ al terminar, agregar fecha.
- Cada tarea completada debe tener su entrada en `CHANGELOG.md`.
- El ID de tarea (P3.1, etc.) debe aparecer en el mensaje de commit.
