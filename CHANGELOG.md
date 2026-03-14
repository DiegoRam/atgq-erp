# CHANGELOG — ATGQ ERP

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versiones según [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Added

- **P8.1** — Dashboard Home con KPIs (`/`):
  - 5 tarjetas KPI: Socios Activos, Cuotas Impagas (mes), Recaudación (mes), Ventas (mes), Stock Crítico
  - Cada KPI es clickeable y navega a la página correspondiente
  - Gráfico de barras: Recaudación Neta últimos 6 meses (Recharts BarChart)
  - Server Component async con getDashboardData() que ejecuta 6 queries en paralelo
  - Reemplaza la página placeholder anterior

- **P8.2** — Exportación Excel (xlsx) en reportes principales:
  - Paquete `xlsx` (SheetJS) instalado con dynamic import para tree-shaking
  - Helper `exportToExcel()` en `src/lib/export.ts` con auto-ancho de columnas
  - Prop `onExportExcel` agregado al componente DataTable (botón Excel junto a CSV)
  - Botón "Excel" agregado a 7 páginas: Administración de Socios, Socios Morosos, Padrón, Movimientos de Fondos, Inventario, Ventas Realizadas, Reportes Mensual
  - Exporta solo los registros filtrados/visibles actualmente

- **P8.3** — Config SOCIOS (3 ABM pages):
  - Categorías Sociales (`/socios/config/categorias`): DataTable con Nombre, Descripción, Monto Base (ARS), Estado + FormModal CRUD
  - Tipo de Cuotas (`/socios/config/tipo-cuotas`): DataTable con Nombre, Descripción, Estado + FormModal CRUD
  - Métodos de Cobranza (`/socios/config/cobranzas`): DataTable con Nombre, Estado + FormModal CRUD
  - Validaciones: nombre unique (23505), no desactivar categorías con socios activos, no desactivar métodos en uso, no desactivar tipos con cuotas impagas
  - Tipos: TipoCuota, CategoriaSocialFormData, TipoCuotaFormData, MetodoCobranzaFormData (src/types/socios.ts)
  - Zod schemas: categoriaSocialSchema, tipoCuotaSchema, metodoCobranzaSchema (src/lib/schemas/socios-config.ts)

- **P7.1** — ABM Actividades (`/actividades`):
  - DataTable: Nombre, Descripción, Monto Cuota (ARS), Inscriptos (count), Estado (badge), Acciones (editar + ver detalle)
  - ActividadForm: FormModal con Nombre, Descripción, Monto Cuota, Activa (switch)
  - Detalle actividad (`/actividades/[id]`): Card con info + tabla de inscriptos (Nro Socio, Apellido, Nombre, Fecha Inscripción)

- **P7.2** — Inscripción/baja de socios en actividades:
  - Desde detalle actividad: botón "Inscribir Socio" con autocomplete + AlertDialog "Dar de baja" por fila
  - Desde perfil socio (`/socios/[id]/actividades`): lista actividades + inscribir en nueva (Select) + dar de baja
  - Soft delete: `UPDATE socios_actividades SET activa = false`
  - Manejo de unique constraint (error.code 23505)

- **P7.3** — Generar Cuota de Actividades (`/actividades/generar-cuota`):
  - Select actividad (solo activas con inscriptos > 0) → pre-llena monto desde actividad.monto_cuota
  - Selector período (mes + año) + monto editable
  - Vista previa: count de socios + monto total
  - Bulk INSERT en cuotas con tipo_cuota='Cuota Actividad'
  - Toast con resumen de generación

- **P7.4** — ABM Actividades Extras (`/actividades/extras`):
  - DataTable: Nombre, Descripción, Fecha, Monto, Acciones (editar)
  - ActividadExtraForm: FormModal con Nombre, Descripción, Fecha (date), Monto

- **P7.5** — Gestión de Turnos (`/turnos`):
  - Tabla con filtros: Fecha, Instalación (Select), Estado (Todos/Confirmado/Cancelado)
  - Columnas: Fecha, Hora Inicio, Hora Fin, Instalación, Socio (nro + nombre), Estado (badge), Acciones
  - TurnoForm: FormModal con autocomplete de socio, Select instalación, fecha, hora inicio/fin
  - Validación de solapamiento: no permite turnos que se superponen en misma instalación (strict inequalities for back-to-back)
  - Cancelar turno: AlertDialog de confirmación, UPDATE estado='cancelado'

- **Pre-requisitos Fase 7:**
  - Tipos TypeScript: Actividad, ActividadFormData, SocioActividad, ActividadExtra, ActividadExtraFormData, Instalacion, Turno, TurnoFormData (src/types/actividades.ts)
  - Zod schemas: actividadSchema, actividadExtraSchema, turnoSchema con refine hora_fin > hora_inicio (src/lib/schemas/actividades.ts)
  - Seed: 5 actividades, 4 extras, 12 inscripciones, 8 turnos (mix confirmado/cancelado) Ene-Mar 2026

- **P6.1** — Nueva Venta POS (`/ventas/nueva`):
  - Layout 2 columnas (8+4): picker de ítems + carrito | cliente + pago
  - Carrito local con useState: agregar, quitar, acumular cantidad
  - Selector de cliente: toggle Socio (autocomplete por nro/nombre) | Cliente (select)
  - Método de pago: default Efectivo, selección de métodos activos
  - Deducción automática de stock para ítems vinculados (egreso en Deposito Central)
  - Diálogo de éxito con opción "Nueva Venta"

- **P6.2** — Ventas Realizadas (`/ventas`):
  - DataTable paginada 50/página
  - Columnas: Fecha, Nro Venta, Cliente/Socio, Ítems, Total, Método Pago, Estado (badge), Acciones
  - Filtros: rango fechas, estado (Todas/Activas/Anuladas)
  - Detalle expandible: líneas de la venta con cantidad, precio, subtotal
  - Anular venta: AlertDialog de confirmación, soft delete (no revierte stock)

- **P6.3** — ABM Clientes (`/ventas/clientes`):
  - DataTable: Apellido, Nombre, DNI, Email, Teléfono, Cant.Compras, Total Comprado
  - Búsqueda por apellido, nombre o DNI
  - ClienteForm: FormModal con validación Zod
  - Computed columns: cant_compras y total_comprado via aggregate query

- **P6.4** — ABM Ítems de Ventas (`/ventas/items`):
  - DataTable: Nombre, Descripción, Precio (ARS), Stock vinculado, Estado (badge)
  - ItemVentaForm: FormModal con Select para vincular a stock_item
  - Al vender ítem vinculado, se descuenta stock automáticamente

- **P6.5** — Reportes de Ventas (3 sub-rutas):
  - Ventas Sumarizadas Mensual (`/ventas/reportes/mensual`): filtro año, tabla Mes/Cantidad/Total/Promedio con footer totales
  - Ventas Sumarizadas Diaria (`/ventas/reportes/diaria`): filtro mes+año, tabla Fecha/Cantidad/Total
  - Venta de Ítem por Período (`/ventas/reportes/por-item`): select ítem + rango fechas, tabla con detalle por venta + footer total

- **P6.6** — Gráficos de Ventas (2 sub-rutas):
  - Gráfico de Ventas (`/ventas/reportes/grafico-ventas`): LineChart ingresos mensuales últimos 12 meses
  - Gráfico de Ítems (`/ventas/reportes/grafico-items`): BarChart horizontal top 10 ítems por ingreso + filtro período

- **Pre-requisitos Fase 6:**
  - Tipos TypeScript: Cliente, ItemVenta, Venta, VentaDetail, VentaItem, CartItem, NuevaVentaData, VentasSearchParams (src/types/ventas.ts)
  - Zod schemas: clienteSchema, itemVentaSchema, nuevaVentaSchema con refine para cliente_id|socio_id (src/lib/schemas/ventas.ts)
  - Componentes: ClienteForm, ItemVentaForm, CarritoVenta (src/components/ventas/)
  - Componente shadcn/ui: alert-dialog instalado
  - Seed: ~5 clientes, ~15 items_ventas (vinculados a stock), ~20 ventas demo Ene-Mar 2026 con ~60 líneas

- **P5.1** — Inventario agrupado por depósito (`/stock`):
  - Vista custom con Collapsible por depósito (header azul claro)
  - Tabla interna: Ítem, Unidad, Cantidad (rojo+bold si ≤0, naranja si ≤10)
  - Banner amarillo de alerta si hay ítems con stock negativo
  - Export CSV con columnas: Depósito, Ítem, Unidad, Cantidad

- **P5.2** — Formulario Ingresos/Egresos de Stock (`/stock/movimientos/nuevo`):
  - Full-page form con Card: Tipo (ingreso/egreso), Depósito, Ítem, Cantidad, Motivo
  - Motivo requerido para egresos (validación Zod refine)
  - Info dinámica: muestra stock actual al seleccionar depósito + ítem
  - UPSERT stock_inventario + INSERT movimientos_stock
  - Toast con nuevo stock, warning naranja si queda negativo

- **P5.3** — Historial Movimientos de Stock (`/stock/movimientos`):
  - DataTable con paginación 50/página
  - Columnas: Fecha, Ítem (join), Depósito (join), Tipo (badge color), Cantidad, Motivo
  - Filtros: Ítem, Depósito, Tipo, Desde, Hasta
  - Export CSV

- **P5.4** — ABM Depósitos (`/stock/depositos`):
  - DataTable: Nombre, Descripción, Estado (badge), Ítems en Stock, Acciones (editar)
  - DepositoForm: FormModal con Nombre (unique), Descripción, Activo (switch)
  - Validación: no se puede desactivar depósito con ítems en stock

- **P5.5** — ABM Ítems de Stock (`/stock/items`):
  - DataTable: Nombre, Descripción, Unidad, Stock Total (rojo ≤0, naranja ≤10), Estado, Acciones
  - StockItemForm: FormModal con Nombre, Descripción, Unidad, Activo, Stock Inicial (solo create)
  - Stock inicial: crea inventario en Deposito Central + movimiento de ingreso

- **Pre-requisitos Fase 5:**
  - Tipos TypeScript: Deposito, StockItem, InventarioRow, MovimientoStock, *FormData, SearchParams (src/types/stock.ts)
  - Zod schemas: depositoSchema, stockItemSchema, movimientoStockSchema con refine para motivo (src/lib/schemas/stock.ts)
  - Nav-config: agregado "Ítems de Stock" al menú STOCK
  - Seed: ~15 stock items (blancos, cartuchos, protección, limpieza), inventario con cantidades variadas (incluye negativo), ~10 movimientos demo Ene-Mar 2026

- **P4.6** — Reportes de TESORERÍA (4 sub-rutas):
  - Sumarización de Conceptos (`/tesoreria/reportes/sumarizacion`): agrupado por categoría/tipo, filtros fecha + caja
  - Concepto entre Fechas (`/tesoreria/reportes/concepto-fechas`): movimientos individuales filtrados por categoría y período
  - Gráfico de Movimientos (`/tesoreria/reportes/grafico-movimientos`): LineChart de ingresos mensuales (12 meses), filtro por caja
  - Gráfico de Mov. de Salidas (`/tesoreria/reportes/grafico-salidas`): BarChart de egresos por categoría, filtro por período

- **P4.4** — Transferencias entre cajas (`/tesoreria/transferencias`):
  - Formulario de transferencia: caja origen (con saldo), caja destino, monto, descripción, fecha
  - Validación: origen ≠ destino, monto ≤ saldo disponible
  - Lógica: crea par de movimientos enlazados con referencia_id cruzada
  - Tabla de últimas 20 transferencias
  - Seed: categorías "Transferencia" (ingreso + egreso) para uso interno

- **P4.3** — Historial Movimientos de Fondos (`/tesoreria/movimientos`):
  - DataTable con paginación 50/página
  - Columnas: Fecha, Caja, Tipo (badge color), Categoría, Descripción, Monto (color +/-)
  - Filtros: rango fechas, caja, tipo, categoría
  - Footer con totales: ingresos, egresos, balance neto
  - Export CSV
  - Soporta query param `?caja=UUID` para link desde ABM Cajas

- **P4.2** — Formulario Ingresar Movimiento (`/tesoreria/movimientos/nuevo`):
  - Full-page form con Card: Tipo (ingreso/egreso), Caja, Categoría (filtrada por tipo), Monto, Descripción, Fecha
  - Obtiene usuario autenticado vía `supabase.auth.getUser()`
  - Toast de éxito con nuevo saldo calculado + botón "Registrar otro"
  - Seed: ~30 movimientos distribuidos Ene-Mar 2026 en 3 cajas (usando bloque DO $$ con user lookup)

- **P4.1** — ABM Cajas (`/tesoreria/cajas`):
  - DataTable: Nombre, Descripción, Saldo Actual (calculado, con color), Estado (badge), Acciones (editar, ver movimientos)
  - Saldo calculado: `saldo_inicial + SUM(ingresos) - SUM(egresos)` vía aggregate query
  - CajaForm: FormModal con Nombre (unique), Descripción, Saldo Inicial, Activa (switch)
  - Seed: 3 cajas (Principal $50.000, Chica $5.000, Actividades $10.000)

- **P4.5** — Config: Categorías de Movimientos (`/tesoreria/config/categorias`):
  - DataTable con columnas: Nombre, Tipo (badge verde/rojo), Estado (badge Activa/Inactiva), Acciones (editar)
  - CategoriaMovimientoForm: FormModal con Nombre, Tipo (select ingreso/egreso), Activa (switch)
  - Server actions: getCategorias, createCategoria, updateCategoria (con manejo de unique constraint)

- **Pre-requisitos Fase 4:**
  - Tipos TypeScript: Caja, CategoriaMovimiento, MovimientoFondo, *FormData, MovimientosSearchParams (src/types/tesoreria.ts)
  - Zod schemas: categoriaMovimientoSchema, cajaSchema, movimientoSchema, transferenciaSchema (src/lib/schemas/tesoreria.ts)
  - Componente shadcn/ui: Switch instalado
  - Seed extendido: 3 cajas, 2 categorías transferencia, ~30 movimientos demo

- **P3.7** — Reportes de SOCIOS:
  - Socios por Categorías (`/socios/reportes/categorias`): tabla con % y BarChart (recharts)
  - Socios por Edades (`/socios/reportes/edades`): rangos 0-17, 18-30, 31-45, 46-60, 61+, Sin dato + BarChart
  - Cuotas cobradas mensualmente (`/socios/reportes/cuotas-mensuales`): filtro por rango de fechas, tabla + LineChart
  - Socios por Localidad (`/socios/reportes/localidad`): tabla descendente + export CSV
  - Componente compartido `ReportLayout` para estructura consistente de reportes

- **P3.6** — Padrón exportable (`/socios/padron`):
  - Tabla completa sin paginación de todos los socios activos (excluye BAJA y fecha_baja)
  - Filtro por categoría con Select
  - Export CSV y botón Imprimir con estilos `@media print`

- **P3.5** — Gestión de cuotas:
  - Vista por socio (`/socios/[id]/cuotas`): tabla de cuotas con estado (badge Pagada/Impaga), fecha pago, método
  - Registrar Pago: modal con monto, fecha, método de pago (RegistrarPagoForm)
  - Generación masiva (`/socios/cuotas/generar`): selección mes/año/tipo/monto, vista previa con conteo, confirmación
  - Redirect `/socios/cuotas` → `/socios/cuotas/generar`

- **P3.4** — Socios morosos (`/socios/morosos`):
  - DataTable con paginación server-side usando RPC `get_socios_morosos`
  - Columnas: cuotas impagas (rojo bold si >3), monto adeudado, última cuota pagada
  - Export CSV de todos los morosos

- **P3.3** — Grupos familiares (`/socios/grupos-familiares`):
  - Tabla con filas expandibles mostrando miembros del grupo
  - Modal para crear grupo familiar con búsqueda de titular y miembros (autocomplete)
  - Acciones: agregar/remover miembros de grupo

- **P3.2** — Formulario alta/edición de socio:
  - SocioForm: modal FormModal size="lg" con grid 2 columnas
  - Campos: Nro Socio (auto-suggest), Apellido (uppercase), Nombre, DNI (unique check), Categoría, Método Cobranza, Fecha Alta/Baja, Localidad, Fecha Nacimiento
  - Validación Zod con react-hook-form + @hookform/resolvers
  - Toast feedback con sonner (éxito/error)
  - Server actions: createSocio, updateSocio, getNextNroSocio, checkDniUnique

- **P3.1** — Tabla de socios con paginación server-side:
  - Página `/socios` con DataTable (50/page) + FacetFilter sidebar por Categoría
  - Columnas: Nro Socio (link clickable para editar), Apellido, Nombre, DNI, Categoría, Fecha Alta, Antigüedad (calc), Fecha Baja, Pagas, Impagas, Cobranza
  - Búsqueda debounced por apellido/nombre/DNI
  - Ordenamiento server-side, filtro por categorías múltiples
  - Server actions con Supabase: getSocios (paginado + join categoría/cobranza + conteo cuotas)

- **Pre-requisitos Fase 3:**
  - Migración RLS: políticas `authenticated_all` en todas las tablas
  - Migración RPCs: `get_category_counts`, `get_socios_morosos`, `get_socios_por_categoria`, `get_socios_por_edad`, `get_cuotas_mensuales`, `get_socios_por_localidad`
  - Componentes shadcn/ui: select, popover, calendar, command, sonner, collapsible, scroll-area
  - Toaster (sonner) integrado en dashboard layout
  - Utilidades: `formatDate`, `formatAntiguedad`, `formatCurrency`, `exportToCSV` (src/lib/format.ts)
  - Tipos TypeScript: Socio, SocioFormData, Cuota, GrupoFamiliar, SocioMoroso, etc. (src/types/socios.ts)
  - Hook `useDebounce` para búsqueda (src/hooks/useDebounce.ts)
  - DataTable: soporte para prop `meta` (permite pasar callbacks como onEdit a columnas)
  - @hookform/resolvers instalado para integración zod + react-hook-form

- **P2.4** — Componentes base reutilizables:
  - `DataTable`: tabla genérica con @tanstack/react-table, paginación server-side, búsqueda, toggle columnas, skeleton loading, export CSV, ordenamiento
  - `FacetFilter`: sidebar de filtros con checkboxes, conteos y "Ver más/menos"
  - `FormModal`: modal genérico con Dialog de shadcn, tamaños sm/md/lg, spinner en submit
  - `PageHeader`: header de página con título, descripción y slot de acciones
  - `StatsCard`: tarjeta de KPI con ícono y tendencia porcentual
  - Barrel export desde `src/components/shared/index.ts`
  - Componentes shadcn/ui instalados: table, dialog, checkbox, skeleton, badge

- **P2.3** — Sistema de tabs del workspace:
  - Zustand store (`tabsStore`) con openTab, closeTab, setActive
  - Persistencia en sessionStorage (se pierden al cerrar navegador)
  - Máximo 8 tabs simultáneos (el más antiguo se cierra automáticamente)
  - Tabs cerrables con botón ×, al cerrar el activo se activa el anterior
  - No duplica tabs: si la sección ya está abierta, la activa
  - Ícono diferenciado: tabla para datos, gráfico para reportes
  - Integración con navbar: clickear un item del dropdown abre tab + navega
  - Sincronización automática del tab activo con la URL actual

- **P2.2** — Layout principal con header y navbar:
  - Route group `(dashboard)` con layout que incluye header + navbar + área de contenido
  - `AppHeader` (server component): título del club, usuario autenticado, fecha actual, botón logout
  - `AppNavbar` (client component): 7 módulos con dropdowns (SOCIOS, ACTIVIDADES, TURNOS, VENTAS, STOCK, TESORERÍA, Security)
  - Configuración de navegación centralizada en `src/lib/nav-config.ts` con todas las rutas y separadores
  - Fondo azul oscuro (#1e3a5f) en navbar, replicando el estilo del sistema legacy
  - Componentes shadcn/ui instalados: dropdown-menu, separator

- **P2.1** — Autenticación con Supabase Auth:
  - Página de login (`/login`) con formulario email + password usando shadcn/ui (Card, Input, Button, Label)
  - Server Action para login (`signInWithPassword`) y logout (`signOut`) con redirect
  - Middleware protege todas las rutas: redirige a `/login` sin sesión, redirige a `/` si ya autenticado
  - Hook `useUser` para acceso al usuario actual desde componentes client
  - Componentes shadcn/ui instalados: card, input, button, label
  - NO incluye registro de usuarios (se hará en P9.1) ni recuperación de contraseña

- **Seed: datos demo de socios** — 50 socios de demostración con cuotas y grupo familiar:
  - 50 socios distribuidos en 8 categorías (Activo, Cadete, Vitalicio, Adherente, Grupo Familia, Grupo Fliar. Miembro, Inactivo, BAJA)
  - 111 cuotas sociales (ene/feb/mar 2026) con variación pagadas/impagas para testear morosos
  - 1 grupo familiar (titular + 3 miembros)
  - Datos argentinos realistas: nombres, DNIs, localidades zona sur GBA, fechas variadas

- **P1.4** — Seed data inicial (`supabase/seed.sql`):
  - 14 categorías sociales del sistema legacy (Activo, Cadete, Vitalicio, Adherente, Grupo Familiar, BAJA, etc.)
  - 6 métodos de cobranza (Efectivo, VISA Crédito/Débito, Mastercard, Transferencia, Débito Automático)
  - 3 tipos de cuotas (Social, Actividad, Especial)
  - 4 roles del sistema (Administrador, Tesorero, Recepcionista, Solo Lectura)
  - 28 permisos por rol/módulo (7 módulos × 4 roles)
  - 1 depósito inicial (Deposito Central)
  - 9 categorías de movimientos de tesorería (4 ingresos + 5 egresos)
  - 3 instalaciones para turnos (Cancha Tiro, Gimnasio, Salón Principal)
  - Idempotente: usa `INSERT ... ON CONFLICT DO NOTHING`

- **P1.3** — Migraciones SQL completas (schema inicial):
  - `supabase/migrations/20260314000001_initial_schema.sql` con 25 tablas
  - Módulos: SOCIOS (6 tablas), ACTIVIDADES (3), TURNOS (2), VENTAS (3), STOCK (3), TESORERÍA (3), SECURITY (3)
  - UUIDs con `gen_random_uuid()`, timestamps con `timestamptz`
  - Row Level Security habilitado en todas las tablas (policies pendientes P9.3)
  - Índices en: socios(nro_socio, dni, categoria_id), cuotas(socio_id, periodo), movimientos_fondos(caja_id, fecha), ventas(fecha)
  - Trigger `update_updated_at` para socios
  - Fix: removido `health_timeout` de `config.toml` (incompatible con Supabase CLI v2.65.5)

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
