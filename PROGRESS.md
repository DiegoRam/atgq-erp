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
| 2 | Auth + Layout | ✅ Completado | 4/4 |
| 3 | SOCIOS | ✅ Completado | 7/7 |
| 4 | TESORERÍA | ✅ Completado | 6/6 |
| 5 | STOCK | ✅ Completado | 5/5 |
| 6 | VENTAS | ✅ Completado | 6/6 |
| 7 | ACTIVIDADES + TURNOS | ✅ Completado | 5/5 |
| 8 | Reportes avanzados | ✅ Completado | 3/3 |
| 9 | Security / RBAC | ✅ Completado | 3/3 |

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
| P2.1 | Login/logout con Supabase Auth + middleware de protección | ✅ | 2026-03-14 |
| P2.2 | Layout principal: header + navbar con dropdowns | ✅ | 2026-03-14 |
| P2.3 | Sistema de tabs del workspace (ModuleTab) | ✅ | 2026-03-14 |
| P2.4 | Componentes base: DataTable, FacetFilter, FormModal, StatsCard | ✅ | 2026-03-14 |

---

## FASE 3 — Módulo SOCIOS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P3.1 | Tabla de socios con paginación server-side + sidebar filtros | ✅ | 2026-03-14 |
| P3.2 | Formulario alta/edición de socio | ✅ | 2026-03-14 |
| P3.3 | Vista grupos familiares | ✅ | 2026-03-14 |
| P3.4 | Vista socios morosos | ✅ | 2026-03-14 |
| P3.5 | Gestión de cuotas (ver, pagar, generar masivo) | ✅ | 2026-03-14 |
| P3.6 | Padrón exportable | ✅ | 2026-03-14 |
| P3.7 | Reportes: por categoría, edad, localidad, cuotas mensuales | ✅ | 2026-03-14 |

---

## FASE 4 — Módulo TESORERÍA

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P4.1 | ABM Cajas (con saldo calculado) | ✅ | 2026-03-14 |
| P4.2 | Formulario Ingresar Movimiento | ✅ | 2026-03-14 |
| P4.3 | Historial Movimientos de Fondos con filtros | ✅ | 2026-03-14 |
| P4.4 | Transferencias entre cajas | ✅ | 2026-03-14 |
| P4.5 | Config: Categorías de movimientos | ✅ | 2026-03-14 |
| P4.6 | Reportes: sumarización, concepto entre fechas, gráficos | ✅ | 2026-03-14 |

---

## FASE 5 — Módulo STOCK

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P5.1 | Inventario agrupado por depósito (con alertas stock negativo) | ✅ | 2026-03-14 |
| P5.2 | Formulario Ingresos/Egresos de stock | ✅ | 2026-03-14 |
| P5.3 | Historial movimientos de stock | ✅ | 2026-03-14 |
| P5.4 | ABM Depósitos | ✅ | 2026-03-14 |
| P5.5 | ABM Ítems de stock | ✅ | 2026-03-14 |

---

## FASE 6 — Módulo VENTAS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P6.1 | Formulario Nueva Venta (POS) | ✅ | 2026-03-14 |
| P6.2 | Historial Ventas Realizadas | ✅ | 2026-03-14 |
| P6.3 | ABM Clientes | ✅ | 2026-03-14 |
| P6.4 | ABM Ítems de ventas | ✅ | 2026-03-14 |
| P6.5 | Reportes: mensual, diaria, por ítem | ✅ | 2026-03-14 |
| P6.6 | Gráficos de ventas e ítems | ✅ | 2026-03-14 |

---

## FASE 7 — Módulo ACTIVIDADES + TURNOS

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P7.1 | ABM Actividades + detalle con inscriptos | ✅ | 2026-03-14 |
| P7.2 | Inscripción/baja de socios en actividades | ✅ | 2026-03-14 |
| P7.3 | Generar cuota masiva de actividades | ✅ | 2026-03-14 |
| P7.4 | ABM Actividades Extras | ✅ | 2026-03-14 |
| P7.5 | Gestión de Turnos (CRUD + validación solapamiento) | ✅ | 2026-03-14 |

---

## FASE 8 — Reportes avanzados

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P8.1 | Dashboard home con KPIs | ✅ | 2026-03-14 |
| P8.2 | Exportación Excel (xlsx) en reportes principales | ✅ | 2026-03-14 |
| P8.3 | Config SOCIOS: categorías sociales, tipos cuotas, cobranzas | ✅ | 2026-03-14 |

---

## FASE 9 — Security / RBAC

| ID | Tarea | Estado | Fecha |
|----|-------|--------|-------|
| P9.1 | ABM usuarios del sistema (Supabase Admin API) | ✅ | 2026-03-14 |
| P9.2 | ABM roles y permisos por módulo | ✅ | 2026-03-14 |
| P9.3 | Supabase RLS policies en todas las tablas | ✅ | 2026-03-14 |

---

## Bloqueadores activos

_Ninguno por ahora._

---

## Notas de implementación

- Para marcar una tarea: cambiar ⬜ por 🔄 al empezar, ✅ al terminar, agregar fecha.
- Cada tarea completada debe tener su entrada en `CHANGELOG.md`.
- El ID de tarea (P3.1, etc.) debe aparecer en el mensaje de commit.
