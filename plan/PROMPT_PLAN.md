# PROMPT_PLAN — ATGQ ERP

Guía de implementación por fases. Cada tarea contiene un **prompt listo para usar con Claude** para implementar esa funcionalidad específica.

**Referencia:** `docs/PRD.md`
**Stack:** Next.js 14 App Router · TypeScript · shadcn/ui · Tailwind CSS · Supabase (local CLI)

---

## Convenciones

- **ID**: Código de tarea (P1.1, P2.3…). Usar en commits y en PROGRESS.md.
- **Deps**: Tareas que deben estar completas antes de iniciar esta.
- **Archivos esperados**: Qué crea o modifica el prompt.
- **Verificación**: Cómo confirmar que la implementación es correcta.

---

## FASE 1 — Scaffold + Base de datos

> Objetivo: Proyecto funcional con base de datos local corriendo y schema completo aplicado.

---

### P1.1 — Inicializar proyecto Next.js

**Deps:** ninguna

**Prompt:**
```
Inicializa un nuevo proyecto Next.js 14 con App Router para el ATGQ ERP.

Requisitos:
- Next.js 14 con App Router (no Pages Router)
- TypeScript estricto
- Tailwind CSS
- shadcn/ui (inicializar con `npx shadcn@latest init`)
- ESLint + Prettier configurados
- Estructura de carpetas:
  src/
    app/           → rutas Next.js
    components/    → componentes reutilizables
      ui/          → componentes shadcn/ui
      shared/      → componentes propios compartidos
    lib/           → utilidades y helpers
    types/         → tipos TypeScript globales

Instalar dependencias adicionales:
- @tanstack/react-table (tablas)
- react-hook-form + zod (formularios y validación)
- recharts (gráficos)
- date-fns (manejo de fechas, locale es-AR)
- lucide-react (íconos, ya incluido en shadcn)

El proyecto se llama "atgq-erp". No configurar Supabase todavía.
Crear un archivo src/lib/utils.ts con la función cn() de shadcn.
Asegurarse que `npm run build` no tenga errores.
```

**Archivos esperados:**
- `package.json`, `tsconfig.json`, `next.config.ts`
- `tailwind.config.ts`, `postcss.config.mjs`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `src/lib/utils.ts`
- `components.json` (shadcn config)

**Verificación:** `npm run build` sin errores, `npm run dev` levanta en localhost:3000.

---

### P1.2 — Configurar Supabase CLI local

**Deps:** P1.1

**Prompt:**
```
Configura Supabase CLI local para el proyecto ATGQ ERP.

Pasos a implementar:
1. Ejecutar `supabase init` en la raíz del proyecto
2. Crear `.env.local` con las variables de entorno para Supabase local:
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<placeholder>
   SUPABASE_SERVICE_ROLE_KEY=<placeholder>
3. Crear el cliente Supabase en:
   - src/lib/supabase/client.ts → createBrowserClient (para componentes cliente)
   - src/lib/supabase/server.ts → createServerClient (para Server Components y Server Actions)
   - src/lib/supabase/middleware.ts → helper para middleware de auth
4. Agregar `.env.local` al `.gitignore`
5. Instalar: @supabase/supabase-js @supabase/ssr

Usar el paquete @supabase/ssr (NO @supabase/auth-helpers-nextjs que está deprecado).
Documentar en un comentario cómo obtener las keys reales con `supabase status`.
```

**Archivos esperados:**
- `supabase/config.toml`
- `.env.local` (en .gitignore)
- `.env.example` (con placeholders, commiteado)
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`

**Verificación:** `supabase start` corre sin errores. Los clientes se importan sin errores de TypeScript.

---

### P1.3 — Migraciones SQL completas

**Deps:** P1.2

**Prompt:**
```
Crea las migraciones SQL de Supabase para el ATGQ ERP con todas las tablas del sistema.

Crear el archivo: supabase/migrations/20260314000001_initial_schema.sql

El schema completo incluye estas tablas (con sus relaciones y constraints):

-- SOCIOS
- metodos_cobranza (id, nombre, activo)
- categorias_sociales (id, nombre, descripcion, monto_base, activa)
- grupos_familiares (id, titular_id→socios, created_at)
- socios (id, nro_socio UNIQUE, apellido, nombre, dni UNIQUE, categoria_id→categorias_sociales, fecha_alta, fecha_baja, metodo_cobranza_id→metodos_cobranza, grupo_familiar_id→grupos_familiares, localidad, fecha_nacimiento, created_at, updated_at)
- tipos_cuotas (id, nombre, descripcion, activo)
- cuotas (id, socio_id→socios, tipo_cuota_id→tipos_cuotas, periodo DATE, monto, fecha_pago, pagada, metodo_pago_id→metodos_cobranza, created_at)

-- ACTIVIDADES
- actividades (id, nombre, descripcion, monto_cuota, activa, created_at)
- socios_actividades (id, socio_id→socios, actividad_id→actividades, fecha_inscripcion, activa, UNIQUE socio+actividad)
- actividades_extras (id, nombre, descripcion, fecha, monto, created_at)

-- TURNOS
- instalaciones (id, nombre, descripcion, activa)
- turnos (id, socio_id→socios, instalacion_id→instalaciones, fecha_turno DATE, hora_inicio TIME, hora_fin TIME, estado CHECK('confirmado','cancelado'), created_at)

-- VENTAS
- clientes (id, apellido, nombre, dni, email, telefono, created_at)
- stock_items (id, nombre, descripcion, unidad DEFAULT 'unidad', activo) [definir antes de items_ventas]
- items_ventas (id, nombre, descripcion, precio, activo, stock_item_id→stock_items NULLABLE)
- ventas (id, cliente_id→clientes NULLABLE, socio_id→socios NULLABLE, fecha TIMESTAMPTZ, total, metodo_pago_id→metodos_cobranza, usuario_id→auth.users, anulada DEFAULT false)
- ventas_items (id, venta_id→ventas, item_id→items_ventas, cantidad INT, precio_unitario, subtotal)

-- STOCK
- depositos (id, nombre UNIQUE, descripcion, activo)
- stock_inventario (id, item_id→stock_items, deposito_id→depositos, cantidad INT DEFAULT 0, UNIQUE item+deposito)
- movimientos_stock (id, item_id→stock_items, deposito_id→depositos, tipo CHECK('ingreso','egreso','transferencia'), cantidad INT, motivo, referencia_id UUID NULLABLE, usuario_id→auth.users, created_at)

-- TESORERÍA
- cajas (id, nombre UNIQUE, descripcion, saldo_inicial DEFAULT 0, activa, created_at)
- categorias_movimientos (id, nombre, tipo CHECK('ingreso','egreso'), activa)
- movimientos_fondos (id, caja_id→cajas, categoria_id→categorias_movimientos, tipo CHECK('ingreso','egreso','transferencia'), monto, descripcion, fecha TIMESTAMPTZ, caja_destino_id→cajas NULLABLE, referencia_id UUID NULLABLE, usuario_id→auth.users, created_at)

-- SECURITY
- roles (id, nombre UNIQUE, descripcion)
- permisos_modulo (id, rol_id→roles, modulo TEXT, puede_leer BOOL, puede_escribir BOOL, puede_eliminar BOOL)
- usuarios_roles (id, user_id→auth.users, rol_id→roles, UNIQUE user+rol)

Reglas:
- Todos los ids son UUID con gen_random_uuid()
- Timestamps con timestamptz y default now()
- Activar Row Level Security (RLS) en todas las tablas pero sin policies aún (se agregan en P9.3)
- Crear índices en: socios(nro_socio), socios(dni), socios(categoria_id), cuotas(socio_id, periodo), movimientos_fondos(caja_id, fecha), ventas(fecha)
```

**Archivos esperados:**
- `supabase/migrations/20260314000001_initial_schema.sql`

**Verificación:** `supabase db reset` aplica sin errores. `supabase db diff` no muestra cambios pendientes.

---

### P1.4 — Seed data inicial

**Deps:** P1.3

**Prompt:**
```
Crea el seed de datos iniciales para el ATGQ ERP en supabase/seed.sql.

Insertar:

-- Categorías sociales (14 tipos del sistema legacy)
Activo, Activo-Ventanilla, Inactivo, Cadete, Cadete-Ventanilla, Vitalicio,
Adherente, Adherente-Ventanilla, Honorario, Grupo Familia, Grupo Familiar-Ventanilla,
Grupo Fliar. Miembro, Grupo Fliar. Miembro-Ventanilla, BAJA
(con monto_base NULL por ahora, a configurar por el admin)

-- Métodos de cobranza
Efectivo, VISA Crédito, VISA Débito, Mastercard, Transferencia Bancaria, Débito Automático

-- Roles del sistema
Administrador (acceso total), Tesorero, Recepcionista, Solo Lectura

-- Permisos por rol (tabla permisos_modulo)
Administrador: todos los módulos con leer=true, escribir=true, eliminar=true
Tesorero: tesoreria+ventas+stock (escribir=true), socios (leer=true, escribir=false)
Recepcionista: socios+turnos (escribir=true), ventas (leer=true), resto leer=true
Solo Lectura: todos los módulos con solo leer=true

-- Depósito inicial
Deposito Central (activo=true)

-- Tipos de cuotas
Cuota Social, Cuota Actividad, Cuota Especial

-- Categorías de movimientos de tesorería
Ingresos: Cuotas Socios, Ventas, Actividades, Otros Ingresos
Egresos: Servicios, Mantenimiento, Sueldos, Compras, Otros Egresos

-- Instalaciones para turnos
Cancha Tiro, Gimnasio, Salón Principal

Asegurarse que el seed se puede re-ejecutar con INSERT ... ON CONFLICT DO NOTHING.
```

**Archivos esperados:**
- `supabase/seed.sql`

**Verificación:** `supabase db reset` (incluye seed) termina sin errores. Consultar tablas y verificar datos.

---

## FASE 2 — Auth + Layout

> Objetivo: Aplicación con login funcional, layout completo con navbar/tabs, y componentes base listos.

---

### P2.1 — Autenticación con Supabase Auth

**Deps:** P1.2, P1.3

**Prompt:**
```
Implementa autenticación completa con Supabase Auth para el ATGQ ERP.

Requisitos:
1. Página de login en /login (app/login/page.tsx)
   - Formulario: email + password
   - Usar shadcn/ui: Card, Input, Button, Label
   - Mostrar errores de auth
   - Redirect a / si ya está autenticado

2. Server Action para login en src/app/login/actions.ts
   - signInWithPassword via supabase server client
   - Redirect a / en éxito, retornar error en falla

3. Middleware en middleware.ts (raíz del proyecto)
   - Proteger todas las rutas excepto /login
   - Refresh de sesión automático
   - Redirect a /login si no hay sesión activa
   - Usar el helper de src/lib/supabase/middleware.ts

4. Componente de logout:
   - Botón en el header
   - Server Action que llama supabase.auth.signOut() y redirect a /login

5. Hook useUser en src/hooks/useUser.ts
   - Retorna el usuario actual desde Supabase Auth

NO implementar registro de usuarios (se hace por el admin en P9.1).
NO implementar recuperación de contraseña en v1.
```

**Archivos esperados:**
- `src/app/login/page.tsx`
- `src/app/login/actions.ts`
- `middleware.ts`
- `src/hooks/useUser.ts`

**Verificación:** Acceder a / sin sesión redirige a /login. Login con credenciales correctas entra al sistema. Logout vuelve a /login.

---

### P2.2 — Layout principal: header y navbar

**Deps:** P2.1

**Prompt:**
```
Implementa el layout principal del ATGQ ERP según el diseño del sistema legacy.

El layout tiene:
1. Header fijo arriba:
   - Izquierda: "Asociación de Tiro y Gimnasia de Quilmes" (título) + "Sistema de Socios y Control Administrativo" (subtítulo)
   - Derecha: "Usuario: [nombre]" + fecha actual en formato DD/MM/YYYY

2. Navbar horizontal debajo del header (fondo azul oscuro #1e3a5f o similar):
   Módulos con dropdown:
   - SOCIOS → [Administración de Socios, Ver Grupos Familiares, Socios Morosos, CUOTAS▸, Padrón, ---, Socios por Categorías, Socios por Edades, Cuotas cobradas mensualmente, Socios por Localidad, Mapas Distribución de Socios, ---, Categorías Sociales, Tipo de Cuotas, Cobranzas]
   - ACTIVIDADES → [Administración de Actividades, Generar Cuota de Actividades, Actividades Extras]
   - TURNOS → [Administrar Turnos]
   - VENTAS → [Nueva Venta, Ventas Realizadas, Clientes, Items de Ventas, ---, Ventas Sumarizadas Mensual, Ventas Sumarizadas Diaria, Venta de Item/periodo, Gráfico de Ventas, Gráfico de Items]
   - STOCK → [Inventario, Ingresos / Egresos, Movimientos de Stock, ---, Depósitos]
   - TESORERÍA → [Cajas, Ingresar Movimiento, Movimientos de Fondos, Transferencias entre cajas, ---, Sumarización de Conceptos, Concepto entre fechas, Gráfico de Movimientos, Gráfico de Movimientos de Salidas, Categorías movimientos]
   - Security → [Usuarios, Roles y Permisos]

Usar shadcn/ui NavigationMenu o DropdownMenu para los dropdowns.
El layout vive en src/app/(dashboard)/layout.tsx.
Las rutas del dashboard empiezan con /dashboard/* o usar route groups.
```

**Archivos esperados:**
- `src/app/(dashboard)/layout.tsx`
- `src/components/shared/AppHeader.tsx`
- `src/components/shared/AppNavbar.tsx`
- `src/components/shared/NavDropdown.tsx`

**Verificación:** El header muestra usuario y fecha. El navbar despliega todos los módulos con sus ítems. Los ítems con --- muestran separadores visuales.

---

### P2.3 — Sistema de tabs del workspace

**Deps:** P2.2

**Prompt:**
```
Implementa el sistema de tabs del workspace para el ATGQ ERP.

El sistema replica el comportamiento del legacy: cada vez que el usuario navega a una sección desde el navbar, se abre como un "tab" en la barra de tabs bajo el navbar. Los tabs son cerrables con ×.

Requisitos:
1. Barra de tabs debajo del navbar, encima del contenido
2. Cada tab muestra: ícono (tabla o gráfico según tipo) + nombre de la sección + botón ×
3. Click en tab navega a esa sección
4. Click en × cierra el tab (si era el activo, activa el anterior)
5. Abrir la misma sección dos veces no duplica el tab (la activa)
6. Estado de tabs persiste en sessionStorage (se pierden al cerrar el navegador)
7. Máximo 8 tabs abiertos simultáneamente (el más antiguo se cierra automáticamente)

Implementación con Zustand (o React Context si se prefiere evitar deps):
- Store: tabsStore con: tabs[], activeTabId, openTab(route, label), closeTab(id), setActive(id)

Crear en:
- src/store/tabsStore.ts (Zustand store)
- src/components/shared/WorkspaceTabs.tsx (UI de la barra de tabs)

El WorkspaceTabs se monta en el layout del dashboard, encima del {children}.
Instalar zustand si se usa.
```

**Archivos esperados:**
- `src/store/tabsStore.ts`
- `src/components/shared/WorkspaceTabs.tsx`

**Verificación:** Abrir 3 módulos distintos muestra 3 tabs. Cerrar un tab con × lo elimina. Recargar la página mantiene los tabs (sessionStorage).

---

### P2.4 — Componentes base reutilizables

**Deps:** P2.2

**Prompt:**
```
Implementa los componentes base reutilizables del ATGQ ERP.

### 1. DataTable (src/components/shared/DataTable.tsx)
Tabla genérica con @tanstack/react-table + shadcn/ui Table:
- Props: columns, data, totalCount, page, pageSize, onPageChange, onSearch, onSort, isLoading
- Toolbar integrado: input de búsqueda rápida, botón "Columns" (toggle visibilidad), botón "+ New" (optional), botón "Exportar CSV"
- Paginación: "X to Y of Z" + botones anterior/siguiente
- Skeleton loading cuando isLoading=true
- Columnas ordenables con indicador de dirección

### 2. FacetFilter (src/components/shared/FacetFilter.tsx)
Sidebar de filtros con conteos:
- Props: title, options: {value, label, count}[], selected: string[], onSelect
- Lista con checkbox + badge de conteo para cada opción
- "Ver todos" / "Ver menos" cuando hay más de 8 opciones
- Mostrar total de elementos seleccionados

### 3. FormModal (src/components/shared/FormModal.tsx)
Modal genérico para formularios:
- Props: open, onOpenChange, title, description?, children, onSubmit, isSubmitting
- Usa shadcn/ui Dialog
- Botones: Cancelar + Guardar (con spinner cuando isSubmitting)
- Tamaño configurable: sm | md | lg

### 4. PageHeader (src/components/shared/PageHeader.tsx)
Header de página:
- Props: title, description?, actions?: ReactNode
- Muestra título grande + descripción opcional + acciones a la derecha (slot para botones)

### 5. StatsCard (src/components/shared/StatsCard.tsx)
Tarjeta de estadística para dashboards:
- Props: title, value, icon, trend?: {value: number, label: string}
- Usa shadcn/ui Card

Exportar todos desde src/components/shared/index.ts.
```

**Archivos esperados:**
- `src/components/shared/DataTable.tsx`
- `src/components/shared/FacetFilter.tsx`
- `src/components/shared/FormModal.tsx`
- `src/components/shared/PageHeader.tsx`
- `src/components/shared/StatsCard.tsx`
- `src/components/shared/index.ts`

**Verificación:** Importar cada componente sin errores TypeScript. `npm run build` sin errores.

---

## FASE 3 — Módulo SOCIOS

> Objetivo: CRUD completo de socios con filtros, cuotas y reportes básicos.

---

### P3.1 — Tabla de socios con paginación server-side

**Deps:** P2.4, P1.4

**Prompt:**
```
Implementa la vista "Administración de Socios" del módulo SOCIOS.

Ruta: /dashboard/socios
Archivo principal: src/app/(dashboard)/socios/page.tsx

Funcionalidades:
1. Tabla de socios con paginación server-side (50 por página)
   Columnas: Nro Socio (link azul), Apellido, Nombre, DNI, Categoría, Fecha Alta, Antigüedad, Fecha Baja, Pagas, Impagas, Cobranza
   - Antigüedad: calculada en frontend como diferencia entre fecha_alta y hoy, formato "Xa Xm Xd"
   - Pagas/Impagas: conteo de cuotas del socio (pagada=true / false)
   - Nro Socio como link que abre el formulario de edición

2. Sidebar izquierdo FacetFilter por Categoría
   - Query separada: SELECT categoria, count(*) FROM socios GROUP BY categoria
   - Al seleccionar una categoría filtra la tabla

3. Toolbar: Quick Search (apellido o nombre), botón "+ New" abre FormModal de alta

4. Server Actions en src/app/(dashboard)/socios/actions.ts:
   - getSocios(params: {page, search, categoria_id}) → {data, count}
   - Usar supabase server client

5. Tipos TypeScript en src/types/socios.ts

Usar el componente DataTable y FacetFilter de P2.4.
Aplicar localización argentina: fechas DD/MM/YYYY.
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/page.tsx`
- `src/app/(dashboard)/socios/actions.ts`
- `src/types/socios.ts`

**Verificación:** La tabla carga socios del seed. El filtro por categoría funciona. La paginación muestra "1 to 50 of X". La búsqueda por apellido filtra correctamente.

---

### P3.2 — Formulario alta/edición de socio

**Deps:** P3.1

**Prompt:**
```
Implementa el formulario de alta y edición de socios del ATGQ ERP.

Usar FormModal del componente base.

Campos del formulario (react-hook-form + zod):
- Nro Socio: número entero, auto-sugerido (máx actual + 1), editable
- Apellido: texto requerido, uppercase automático
- Nombre: texto requerido
- DNI: texto, único (validar contra DB en onChange)
- Categoría: select con opciones de categorias_sociales
- Fecha Alta: date picker, default hoy
- Fecha Baja: date picker, opcional
- Método de cobranza: select con metodos_cobranza
- Localidad: texto opcional
- Fecha de nacimiento: date picker, opcional

Server Actions en src/app/(dashboard)/socios/actions.ts (agregar):
- createSocio(data) → {success, error}
- updateSocio(id, data) → {success, error}
- getNextNroSocio() → número

Validaciones zod:
- nro_socio único (verificar en DB)
- dni único si se provee
- fecha_baja >= fecha_alta si se provee
- apellido y nombre no vacíos

Al guardar exitosamente: cerrar modal, revalidar path, mostrar toast de éxito.
Usar shadcn/ui toast (Sonner o el Toast de shadcn).
```

**Archivos esperados:**
- `src/components/socios/SocioForm.tsx`
- Actualización de `src/app/(dashboard)/socios/actions.ts`

**Verificación:** Crear un socio nuevo aparece en la tabla. Editar socio existente guarda cambios. Validaciones muestran mensajes de error apropiados.

---

### P3.3 — Grupos familiares

**Deps:** P3.1

**Prompt:**
```
Implementa la vista "Grupos Familiares" del módulo SOCIOS.

Ruta: /dashboard/socios/grupos-familiares

Funcionalidades:
1. Tabla de grupos familiares
   Columnas: Nro Grupo, Titular (Nro Socio + Nombre), Cantidad Miembros, Acciones

2. Al expandir un grupo (row expand): lista de miembros con Nro Socio, Nombre, Categoría

3. Crear grupo familiar:
   - Seleccionar titular (autocomplete de socios)
   - Agregar miembros (multi-select de socios)

4. Asignar socio existente a grupo familiar desde esta vista

Server Actions:
- getGruposFamiliares(params) → lista con miembros expandidos
- createGrupoFamiliar(data)
- addMiembroToGrupo(grupoId, socioId)
- removeMiembroFromGrupo(grupoId, socioId)
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/grupos-familiares/page.tsx`
- `src/app/(dashboard)/socios/grupos-familiares/actions.ts`
- `src/components/socios/GrupoFamiliarForm.tsx`

**Verificación:** Los grupos se muestran con sus miembros. Se puede crear un grupo y agregar miembros.

---

### P3.4 — Socios morosos

**Deps:** P3.1

**Prompt:**
```
Implementa la vista "Socios Morosos" del módulo SOCIOS.

Ruta: /dashboard/socios/morosos

Es una vista filtrada de socios que tienen cuotas impagas.

Query base:
SELECT s.*, COUNT(c.id) as cuotas_impagas
FROM socios s
JOIN cuotas c ON c.socio_id = s.id
WHERE c.pagada = false
GROUP BY s.id
HAVING COUNT(c.id) > 0
ORDER BY cuotas_impagas DESC

Columnas adicionales respecto a la tabla principal:
- Cuotas Impagas (número, resaltado en rojo si > 3)
- Monto Total Adeudado (suma de cuotas impagas)
- Última cuota pagada (fecha)

Exportar a CSV el listado completo de morosos.
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/morosos/page.tsx`
- `src/app/(dashboard)/socios/morosos/actions.ts`

**Verificación:** Solo aparecen socios con cuotas impagas. El monto adeudado es correcto.

---

### P3.5 — Gestión de cuotas

**Deps:** P3.2

**Prompt:**
```
Implementa la gestión de cuotas del módulo SOCIOS.

### Vista de cuotas de un socio
Ruta: /dashboard/socios/[id]/cuotas

Tabla con columnas: Período (mes/año), Tipo, Monto, Estado (Paga/Impaga), Fecha Pago, Método Pago
- Cuotas impagas resaltadas en rojo
- Botón "Registrar pago" en cada cuota impaga

### Registrar pago (FormModal):
- Cuota seleccionada (readonly)
- Monto (pre-llenado, editable para pagos parciales)
- Fecha de pago (default hoy)
- Método de pago (select)
- Al confirmar: marcar cuota como pagada, crear movimiento en tesorería si caja configurada

### Generar cuotas masivas
Ruta: /dashboard/socios/cuotas/generar
- Seleccionar período (mes + año)
- Seleccionar tipo de cuota
- Preview: cuántos socios activos se afectarán y monto total
- Confirmar generación masiva
- Acción: INSERT INTO cuotas para todos los socios activos del período

Server Actions en src/app/(dashboard)/socios/cuotas/actions.ts:
- getCuotasBySocio(socioId)
- registrarPago(cuotaId, data)
- generarCuotasMasivas(periodo, tipoCuotaId)
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/[id]/cuotas/page.tsx`
- `src/app/(dashboard)/socios/cuotas/generar/page.tsx`
- `src/app/(dashboard)/socios/cuotas/actions.ts`
- `src/components/socios/RegistrarPagoForm.tsx`

**Verificación:** Las cuotas de un socio se listan correctamente. Registrar pago cambia el estado de la cuota. La generación masiva crea N registros.

---

### P3.6 — Padrón exportable

**Deps:** P3.1

**Prompt:**
```
Implementa el Padrón de socios del módulo SOCIOS.

Ruta: /dashboard/socios/padron

Es el listado oficial de socios activos (categoría != 'BAJA' y fecha_baja IS NULL),
ordenado alfabéticamente por apellido.

Columnas: Nro Socio, Apellido, Nombre, DNI, Categoría, Fecha Alta, Antigüedad

Funcionalidades:
1. Tabla completa (sin paginación visual, carga todos los activos)
2. Filtro por categoría (dropdown, no sidebar)
3. Botón "Exportar CSV" que descarga el padrón completo filtrado
4. Botón "Imprimir" que abre una ventana de impresión formateada con el logo/nombre del club

El CSV debe tener headers en español.
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/padron/page.tsx`
- `src/app/(dashboard)/socios/padron/actions.ts`

**Verificación:** Solo socios activos aparecen. La exportación CSV descarga correctamente.

---

### P3.7 — Reportes de SOCIOS

**Deps:** P3.1, P2.4

**Prompt:**
```
Implementa los reportes del módulo SOCIOS.

### Socios por Categorías (/dashboard/socios/reportes/por-categorias)
- Tabla: Categoría, Cantidad, Porcentaje del total
- Gráfico de barras (recharts BarChart): categoría en eje X, cantidad en eje Y
- Excluir categoría BAJA del porcentaje

### Socios por Edades (/dashboard/socios/reportes/por-edades)
- Calcular edad de socios con fecha_nacimiento
- Agrupar en rangos: 0-17, 18-30, 31-45, 46-60, 61+, Sin dato
- Tabla + gráfico de barras

### Cuotas cobradas mensualmente (/dashboard/socios/reportes/cuotas-mensuales)
- Filtros: rango de fechas (mes inicio → mes fin)
- Tabla: Mes, Cantidad Cuotas Pagadas, Monto Total Cobrado
- Gráfico de línea (recharts LineChart): evolución mensual de recaudación

### Socios por Localidad (/dashboard/socios/reportes/por-localidad)
- Tabla: Localidad, Cantidad, ordenado desc
- Solo socios activos
- Exportar CSV

Todos los reportes usan un componente ReportLayout con: PageHeader, filtros de fecha/opciones, tabla, gráfico.
Crear src/components/shared/ReportLayout.tsx.
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/reportes/` (4 sub-rutas)
- `src/components/shared/ReportLayout.tsx`

**Verificación:** Los gráficos renderizan con datos reales. Los filtros de fecha actualizan los resultados.

---

## FASE 4 — Módulo TESORERÍA

> Objetivo: Gestión completa de fondos con cajas, movimientos y reportes.

---

### P4.1 — ABM Cajas

**Deps:** P2.4, P1.4

**Prompt:**
```
Implementa la gestión de Cajas del módulo TESORERÍA.

Ruta: /dashboard/tesoreria/cajas

Tabla con columnas: Nombre, Descripción, Saldo Actual (calculado), Estado, Acciones
- Saldo actual = saldo_inicial + SUM(ingresos) - SUM(egresos) de movimientos_fondos
- Estado: badge verde (activa) / gris (inactiva)
- Acciones: Editar, Ver movimientos (link a P4.3 filtrado por caja)

Formulario de alta/edición:
- Nombre (único), Descripción, Saldo Inicial, Estado activa/inactiva

Server Actions en src/app/(dashboard)/tesoreria/cajas/actions.ts:
- getCajas() → lista con saldo calculado
- createCaja(data)
- updateCaja(id, data)
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/cajas/page.tsx`
- `src/app/(dashboard)/tesoreria/cajas/actions.ts`
- `src/components/tesoreria/CajaForm.tsx`

**Verificación:** Las cajas del seed aparecen. El saldo calculado es correcto (saldo_inicial si no hay movimientos).

---

### P4.2 — Ingresar Movimiento

**Deps:** P4.1

**Prompt:**
```
Implementa el formulario "Ingresar Movimiento" del módulo TESORERÍA.

Ruta: /dashboard/tesoreria/ingresar-movimiento

Formulario (react-hook-form + zod):
- Tipo: radio/toggle INGRESO | EGRESO
- Caja: select (solo cajas activas)
- Categoría: select (filtrado por tipo ingreso/egreso desde categorias_movimientos)
- Monto: number positivo, con separador de miles y 2 decimales
- Descripción: textarea opcional
- Fecha: date+time picker, default ahora
- Método de pago: select (metodos_cobranza), solo para ingresos

Al guardar:
- INSERT en movimientos_fondos
- Mostrar el nuevo saldo de la caja afectada
- Toast de éxito con opción "Registrar otro"

Server Action:
- ingresarMovimiento(data) → {success, nuevoSaldo}
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/ingresar-movimiento/page.tsx`
- `src/app/(dashboard)/tesoreria/ingresar-movimiento/actions.ts`

**Verificación:** Registrar un ingreso aumenta el saldo de la caja. Registrar un egreso lo disminuye.

---

### P4.3 — Movimientos de Fondos (historial)

**Deps:** P4.2

**Prompt:**
```
Implementa el historial de Movimientos de Fondos del módulo TESORERÍA.

Ruta: /dashboard/tesoreria/movimientos

Tabla con columnas: Fecha, Caja, Tipo (badge verde/rojo), Categoría, Descripción, Monto, Saldo tras movimiento, Usuario

Filtros (sidebar o toolbar):
- Rango de fechas (desde/hasta)
- Caja (select)
- Tipo (INGRESO/EGRESO/TRANSFERENCIA)
- Categoría (select)

Al pie de la tabla:
- Total ingresos del período filtrado
- Total egresos del período filtrado
- Balance neto

Paginación server-side 50 por página.
Exportar CSV del período filtrado.
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/movimientos/page.tsx`
- `src/app/(dashboard)/tesoreria/movimientos/actions.ts`

**Verificación:** Los movimientos del seed aparecen. Los filtros funcionan. Los totales son correctos.

---

### P4.4 — Transferencias entre cajas

**Deps:** P4.1

**Prompt:**
```
Implementa las Transferencias entre cajas del módulo TESORERÍA.

Ruta: /dashboard/tesoreria/transferencias

Formulario:
- Caja origen: select (muestra saldo actual entre paréntesis)
- Caja destino: select (diferente a origen, validado)
- Monto: number (validar que no supere saldo de caja origen)
- Descripción: texto opcional
- Fecha: datetime, default ahora

Al confirmar:
- INSERT dos movimientos: egreso en origen + ingreso en destino, con referencia_id cruzada
- Tipo = 'transferencia' en ambos
- Mostrar nuevo saldo de ambas cajas

Historial de transferencias: tabla simple de las últimas 20 transferencias.

Server Action:
- realizarTransferencia(data) → {success, saldoOrigen, saldoDestino}
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/transferencias/page.tsx`
- `src/app/(dashboard)/tesoreria/transferencias/actions.ts`

**Verificación:** Una transferencia crea 2 movimientos vinculados. El saldo de origen baja y el de destino sube.

---

### P4.5 — Configuración: categorías de movimientos

**Deps:** P4.1

**Prompt:**
```
Implementa el ABM de Categorías de Movimientos del módulo TESORERÍA.

Ruta: /dashboard/tesoreria/categorias

Tabla: Nombre, Tipo (INGRESO/EGRESO con badge), Activa, Acciones (editar/desactivar)
Formulario: Nombre, Tipo (toggle), Activa

Las categorías desactivadas no aparecen en el formulario de ingreso de movimientos.
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/categorias/page.tsx`
- `src/app/(dashboard)/tesoreria/categorias/actions.ts`

---

### P4.6 — Reportes de TESORERÍA

**Deps:** P4.3

**Prompt:**
```
Implementa los reportes del módulo TESORERÍA.

### Sumarización de Conceptos (/dashboard/tesoreria/reportes/sumarizacion)
- Filtro: rango de fechas + caja (opcional)
- Tabla: Categoría, Tipo, Cantidad movimientos, Total ARS
- Ordenar por monto desc

### Concepto entre fechas (/dashboard/tesoreria/reportes/concepto-fechas)
- Filtros: categoría (select), fecha desde, fecha hasta
- Tabla de movimientos de esa categoría en el período

### Gráfico de Movimientos (/dashboard/tesoreria/reportes/grafico-movimientos)
- LineChart de ingresos mensuales en el último año
- Filtro por caja

### Gráfico de Movimientos de Salidas (/dashboard/tesoreria/reportes/grafico-salidas)
- BarChart de egresos por categoría en el período seleccionado
```

**Archivos esperados:**
- `src/app/(dashboard)/tesoreria/reportes/` (4 sub-rutas)

---

## FASE 5 — Módulo STOCK

> Objetivo: Control de inventario con ingresos/egresos y trazabilidad de movimientos.

---

### P5.1 — Inventario agrupado por depósito

**Deps:** P2.4, P1.4

**Prompt:**
```
Implementa la vista de Inventario del módulo STOCK.

Ruta: /dashboard/stock/inventario

Vista agrupada por depósito (collapsible):
- Header de grupo: "Depósito => [Nombre]" con fondo azul claro
- Columnas: Depósito, Ítem, Cantidad
- Cantidad en rojo si <= 0, en naranja si <= 10

Toolbar:
- "Group By" dropdown: agrupar por depósito (default) o por categoría de ítem
- "Exportar" CSV del inventario completo

Paginación: 50 ítems por página total.

Server Action:
- getInventario(params) → {depositos: [{nombre, items: [{nombre, cantidad}]}]}

Alerta visual prominent si hay ítems con cantidad negativa (banner amarillo arriba).
```

**Archivos esperados:**
- `src/app/(dashboard)/stock/inventario/page.tsx`
- `src/app/(dashboard)/stock/inventario/actions.ts`

**Verificación:** Los ítems del seed aparecen agrupados por depósito. Los negativos aparecen en rojo.

---

### P5.2 — Ingresos/Egresos de stock

**Deps:** P5.1

**Prompt:**
```
Implementa el formulario de Ingresos/Egresos del módulo STOCK.

Ruta: /dashboard/stock/movimiento

Formulario:
- Tipo: toggle INGRESO | EGRESO
- Depósito: select (depósitos activos)
- Ítem: select con búsqueda (stock_items activos), muestra stock actual entre paréntesis
- Cantidad: number positivo
- Motivo: texto, opcional para ingresos, requerido para egresos
- Fecha: datetime default ahora

Validación: para egresos, alertar si la cantidad supera el stock disponible (no bloquear, solo avisar con confirm dialog).

Al guardar:
- INSERT en movimientos_stock
- UPDATE stock_inventario (upsert: cantidad += o -= según tipo)
- Toast con nuevo stock del ítem

Server Action:
- registrarMovimientoStock(data) → {success, nuevoStock}
```

**Archivos esperados:**
- `src/app/(dashboard)/stock/movimiento/page.tsx`
- `src/app/(dashboard)/stock/movimiento/actions.ts`

---

### P5.3 — Historial movimientos de stock

**Deps:** P5.2

**Prompt:**
```
Implementa el historial de Movimientos de Stock.

Ruta: /dashboard/stock/movimientos

Tabla: Fecha, Ítem, Depósito, Tipo (INGRESO/EGRESO/TRANSFERENCIA badge), Cantidad, Motivo, Usuario

Filtros: ítem (select), depósito (select), tipo, rango de fechas.
Paginación server-side 50 por página.
Exportar CSV.
```

**Archivos esperados:**
- `src/app/(dashboard)/stock/movimientos/page.tsx`
- `src/app/(dashboard)/stock/movimientos/actions.ts`

---

### P5.4 — ABM Depósitos

**Deps:** P1.4

**Prompt:**
```
Implementa el ABM de Depósitos del módulo STOCK.

Ruta: /dashboard/stock/depositos

Tabla: Nombre, Descripción, Activo, Cantidad de ítems (conteo), Acciones
Formulario: Nombre (único), Descripción, Activo toggle

No se puede desactivar un depósito que tenga ítems con cantidad > 0.
```

**Archivos esperados:**
- `src/app/(dashboard)/stock/depositos/page.tsx`
- `src/app/(dashboard)/stock/depositos/actions.ts`

---

### P5.5 — ABM Ítems de stock

**Deps:** P1.4

**Prompt:**
```
Implementa el ABM de Ítems de Stock.

Ruta: /dashboard/stock/items

Tabla: Nombre, Descripción, Unidad, Stock Total (suma de todos los depósitos), Activo, Acciones
Formulario: Nombre, Descripción, Unidad (text, default 'unidad'), Activo toggle

Al crear un ítem nuevo: opcionalmente crear stock inicial en Depósito Central.
```

**Archivos esperados:**
- `src/app/(dashboard)/stock/items/page.tsx`
- `src/app/(dashboard)/stock/items/actions.ts`

---

## FASE 6 — Módulo VENTAS

> Objetivo: Punto de venta completo con historial y reportes.

---

### P6.1 — Nueva Venta (POS)

**Deps:** P2.4, P5.5, P1.4

**Prompt:**
```
Implementa el formulario de Nueva Venta (punto de venta) del módulo VENTAS.

Ruta: /dashboard/ventas/nueva

Layout en dos columnas:
- Izquierda: Lista de ítems de la venta (carrito)
  - Tabla: Ítem, Cantidad, Precio Unit., Subtotal, quitar(×)
  - Agregar ítem: select de items_ventas + cantidad + precio (editable)
  - Total al pie

- Derecha: Datos de la venta
  - Cliente: toggle "Socio" (autocomplete nro/nombre) | "Externo" (select o crear cliente)
  - Método de pago: select
  - Botón "Confirmar Venta"

Al confirmar:
- INSERT en ventas y ventas_items (transaction)
- Si los ítems tienen stock_item_id: descontar del stock automáticamente (P5.2 action)
- Mostrar modal de "Venta registrada" con opción imprimir/nueva venta

Server Action:
- crearVenta(data) → {success, ventaId}
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/nueva/page.tsx`
- `src/app/(dashboard)/ventas/nueva/actions.ts`
- `src/components/ventas/CarritoVenta.tsx`

**Verificación:** Crear una venta con 2 ítems la persiste correctamente. El stock se descuenta si aplica.

---

### P6.2 — Ventas Realizadas

**Deps:** P6.1

**Prompt:**
```
Implementa el historial de Ventas Realizadas.

Ruta: /dashboard/ventas/realizadas

Tabla: Fecha, Nro Venta, Cliente/Socio, Ítems (cantidad de líneas), Total, Método Pago, Estado (activa/anulada), Acciones
- Click en fila expande detalle de ítems
- Acción "Anular" con confirmación (soft delete: anulada=true)

Filtros: rango de fechas, cliente/socio, estado.
Paginación 50 por página.
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/realizadas/page.tsx`
- `src/app/(dashboard)/ventas/realizadas/actions.ts`

---

### P6.3 — ABM Clientes

**Deps:** P2.4

**Prompt:**
```
Implementa el ABM de Clientes del módulo VENTAS.

Ruta: /dashboard/ventas/clientes

Tabla: Apellido, Nombre, DNI, Email, Teléfono, Cantidad Compras, Total Comprado, Acciones
Formulario: Apellido, Nombre, DNI (opcional), Email (opcional), Teléfono (opcional)
Búsqueda por nombre o DNI.
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/clientes/page.tsx`
- `src/app/(dashboard)/ventas/clientes/actions.ts`

---

### P6.4 — ABM Ítems de ventas

**Deps:** P5.5

**Prompt:**
```
Implementa el ABM de Ítems de Ventas.

Ruta: /dashboard/ventas/items

Tabla: Nombre, Descripción, Precio (ARS), Stock vinculado (si tiene), Activo, Acciones
Formulario: Nombre, Descripción, Precio, Stock Item vinculado (select opcional de stock_items), Activo

Los ítems inactivos no aparecen en el formulario de nueva venta.
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/items/page.tsx`
- `src/app/(dashboard)/ventas/items/actions.ts`

---

### P6.5 — Reportes de VENTAS

**Deps:** P6.2

**Prompt:**
```
Implementa los reportes del módulo VENTAS.

### Ventas Sumarizadas Mensual (/dashboard/ventas/reportes/mensual)
- Filtro: año
- Tabla: Mes, Cantidad Ventas, Total ARS, Promedio por venta

### Ventas Sumarizadas Diaria (/dashboard/ventas/reportes/diaria)
- Filtro: mes + año (o rango de fechas)
- Tabla: Fecha, Cantidad Ventas, Total ARS

### Venta de Item/periodo (/dashboard/ventas/reportes/por-item)
- Filtros: ítem (select requerido) + rango de fechas
- Tabla: Fecha, Nro Venta, Cliente, Cantidad, Precio, Subtotal
- Total al pie
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/reportes/` (3 sub-rutas)

---

### P6.6 — Gráficos de VENTAS

**Deps:** P6.5

**Prompt:**
```
Implementa los gráficos del módulo VENTAS.

### Gráfico de Ventas (/dashboard/ventas/reportes/grafico-ventas)
- LineChart: evolución mensual de ingresos por ventas (último año)
- Tooltip con monto y cantidad de ventas del mes

### Gráfico de Items (/dashboard/ventas/reportes/grafico-items)
- BarChart horizontal: top 10 ítems más vendidos (por monto) en el período
- Filtro: rango de fechas
```

**Archivos esperados:**
- `src/app/(dashboard)/ventas/reportes/grafico-ventas/page.tsx`
- `src/app/(dashboard)/ventas/reportes/grafico-items/page.tsx`

---

## FASE 7 — Módulo ACTIVIDADES + TURNOS

---

### P7.1 — ABM Actividades

**Deps:** P2.4, P1.4

**Prompt:**
```
Implementa el ABM de Actividades del módulo ACTIVIDADES.

Ruta: /dashboard/actividades

Tabla: Nombre, Descripción, Monto Cuota (ARS), Socios Inscriptos (conteo), Activa, Acciones
Formulario: Nombre, Descripción, Monto Cuota, Activa

Al ver detalle de una actividad: lista de socios inscriptos con Nro Socio, Nombre, Fecha Inscripción.
```

**Archivos esperados:**
- `src/app/(dashboard)/actividades/page.tsx`
- `src/app/(dashboard)/actividades/actions.ts`
- `src/app/(dashboard)/actividades/[id]/page.tsx`

---

### P7.2 — Inscripción de socios a actividades

**Deps:** P7.1, P3.1

**Prompt:**
```
Implementa la inscripción de socios a actividades.

Desde el detalle de una actividad (P7.1), agregar funcionalidad:
- Botón "Inscribir Socio": autocomplete de socios (por nro o apellido)
- Botón "Dar de baja" en la lista de inscriptos (soft delete: activa=false)

Desde el formulario de un socio (P3.2), agregar tab "Actividades":
- Lista de actividades en las que está inscripto
- Inscribir en nueva actividad (select)
```

**Archivos esperados:**
- Actualización de `src/app/(dashboard)/actividades/[id]/page.tsx`
- Actualización de `src/components/socios/SocioForm.tsx` (o nueva tab)

---

### P7.3 — Generar cuota masiva de actividades

**Deps:** P7.2, P3.5

**Prompt:**
```
Implementa "Generar Cuota de Actividades" del módulo ACTIVIDADES.

Ruta: /dashboard/actividades/generar-cuota

Formulario:
- Actividad: select (activas con socios inscriptos)
- Período: mes + año
- Monto: pre-llenado del monto_cuota de la actividad, editable
- Preview: tabla con los socios que recibirán la cuota (inscriptos activos)
- Botón "Generar N cuotas"

Al confirmar:
- INSERT en cuotas para cada socio inscripto activo en la actividad
- tipo_cuota = 'Cuota Actividad'
- Mostrar resumen: "Se generaron N cuotas por un total de ARS X"
```

**Archivos esperados:**
- `src/app/(dashboard)/actividades/generar-cuota/page.tsx`
- `src/app/(dashboard)/actividades/generar-cuota/actions.ts`

---

### P7.4 — Actividades Extras

**Deps:** P7.1

**Prompt:**
```
Implementa el ABM de Actividades Extras.

Ruta: /dashboard/actividades/extras

Tabla: Nombre, Descripción, Fecha, Monto, Acciones
Formulario: Nombre, Descripción, Fecha (date picker), Monto
Son actividades puntuales sin inscripción recurrente.
```

**Archivos esperados:**
- `src/app/(dashboard)/actividades/extras/page.tsx`
- `src/app/(dashboard)/actividades/extras/actions.ts`

---

### P7.5 — Gestión de Turnos

**Deps:** P1.4, P3.1

**Prompt:**
```
Implementa la gestión de Turnos del módulo TURNOS.

Ruta: /dashboard/turnos

Vista principal: tabla de turnos con filtros
Columnas: Fecha, Hora Inicio, Hora Fin, Instalación, Socio (Nro + Nombre), Estado (badge)

Filtros: fecha (date picker), instalación (select), estado (confirmado/cancelado)

Crear turno (FormModal):
- Socio: autocomplete
- Instalación: select
- Fecha: date picker
- Hora inicio / fin: time pickers
- Validación: no se puede solapar con otro turno en la misma instalación y franja horaria

Cancelar turno: botón con confirmación → estado = 'cancelado'

Server Actions:
- getTurnos(params)
- crearTurno(data) → valida solapamiento
- cancelarTurno(id)
```

**Archivos esperados:**
- `src/app/(dashboard)/turnos/page.tsx`
- `src/app/(dashboard)/turnos/actions.ts`
- `src/components/turnos/TurnoForm.tsx`

---

## FASE 8 — Reportes avanzados

---

### P8.1 — Dashboard home con KPIs

**Deps:** P3.1, P4.3, P5.1, P6.2

**Prompt:**
```
Implementa la página de inicio (dashboard home) del ATGQ ERP.

Ruta: /dashboard (o /dashboard/home)

Mostrar tarjetas de KPIs principales:
- Total socios activos (con link a tabla de socios)
- Cuotas impagas del mes actual (con link a socios morosos)
- Recaudación del mes actual (ingresos - egresos de tesorería)
- Ventas del mes actual (total ARS)
- Ítems con stock crítico (cantidad <= 0, con link a inventario)

Un mini gráfico de barras: recaudación últimos 6 meses.

Usar el componente StatsCard de P2.4.
Los datos se cargan con Server Components (no se necesita client-side fetch).
```

**Archivos esperados:**
- `src/app/(dashboard)/page.tsx` (o home/page.tsx)

---

### P8.2 — Exportación Excel de reportes

**Deps:** P3.7, P4.6, P6.5

**Prompt:**
```
Agrega exportación a Excel (xlsx) en los principales reportes del ATGQ ERP.

Instalar: xlsx (SheetJS)

Crear un helper genérico: src/lib/export.ts
- exportToCSV(data, filename, headers) → descarga CSV
- exportToExcel(data, filename, sheetName, headers) → descarga .xlsx

Agregar botón "Exportar Excel" junto al "Exportar CSV" en:
- Administración de Socios (P3.1)
- Socios Morosos (P3.4)
- Padrón (P3.6)
- Movimientos de Fondos (P4.3)
- Inventario (P5.1)
- Ventas Realizadas (P6.2)
- Reportes mensuales (P6.5)

El botón solo exporta los registros filtrados actualmente visibles (respeta filtros activos).
```

**Archivos esperados:**
- `src/lib/export.ts`
- Actualizaciones en las páginas mencionadas

---

### P8.3 — Configuración de categorías sociales y cuotas

**Deps:** P3.1

**Prompt:**
```
Implementa las páginas de configuración del módulo SOCIOS.

### Categorías Sociales (/dashboard/socios/config/categorias)
Tabla: Nombre, Monto Base (ARS), Activa, Acciones
Formulario: Nombre (único), Descripción, Monto Base, Activa

### Tipo de Cuotas (/dashboard/socios/config/tipos-cuotas)
Tabla: Nombre, Descripción, Activo, Acciones
Formulario: Nombre, Descripción, Activo

### Cobranzas (/dashboard/socios/config/cobranzas)
Tabla: Nombre, Activo, Acciones
Formulario: Nombre, Activo
(CRUD de metodos_cobranza)
```

**Archivos esperados:**
- `src/app/(dashboard)/socios/config/` (3 sub-rutas)

---

## FASE 9 — Security / RBAC

---

### P9.1 — ABM de usuarios del sistema

**Deps:** P2.1

**Prompt:**
```
Implementa el ABM de usuarios del módulo Security.

Ruta: /dashboard/security/usuarios

Tabla: Email, Nombre (user_metadata), Rol(es), Último acceso, Estado, Acciones

Crear usuario:
- Email + contraseña temporal
- Usar Supabase Admin API (service role key) para crear el usuario en auth.users
- Asignar rol al crear

Editar usuario:
- Cambiar rol(es)
- Activar/desactivar (supabase.auth.admin.updateUserById con banned=true/false)

IMPORTANTE: Solo usuarios con rol Administrador pueden acceder a /dashboard/security.
Implementar verificación de rol en el Server Component antes de renderizar.
```

**Archivos esperados:**
- `src/app/(dashboard)/security/usuarios/page.tsx`
- `src/app/(dashboard)/security/usuarios/actions.ts`

---

### P9.2 — ABM de roles y permisos

**Deps:** P9.1

**Prompt:**
```
Implementa el ABM de Roles y Permisos del módulo Security.

Ruta: /dashboard/security/roles

Tabla de roles: Nombre, Descripción, Usuarios asignados (conteo), Acciones
Formulario de rol: Nombre, Descripción

Vista de permisos de un rol:
Tabla con todos los módulos (socios, actividades, turnos, ventas, stock, tesoreria, security)
y checkboxes para: Leer, Escribir, Eliminar.
Guardar todos los permisos del rol en un solo submit.
```

**Archivos esperados:**
- `src/app/(dashboard)/security/roles/page.tsx`
- `src/app/(dashboard)/security/roles/[id]/page.tsx`
- `src/app/(dashboard)/security/roles/actions.ts`

---

### P9.3 — Supabase RLS policies

**Deps:** P9.2

**Prompt:**
```
Implementa Row Level Security (RLS) en Supabase para el ATGQ ERP.

Crear migración: supabase/migrations/20260314000002_rls_policies.sql

Estrategia:
1. Crear una función helper en Postgres:
   CREATE OR REPLACE FUNCTION get_user_modulo_permission(modulo text, permiso text)
   RETURNS boolean AS $$
     SELECT COALESCE((
       SELECT CASE permiso
         WHEN 'leer' THEN pm.puede_leer
         WHEN 'escribir' THEN pm.puede_escribir
         WHEN 'eliminar' THEN pm.puede_eliminar
       END
       FROM usuarios_roles ur
       JOIN permisos_modulo pm ON pm.rol_id = ur.rol_id
       WHERE ur.user_id = auth.uid() AND pm.modulo = get_user_modulo_permission.modulo
       LIMIT 1
     ), false);
   $$ LANGUAGE sql SECURITY DEFINER;

2. Aplicar policies en todas las tablas agrupadas por módulo:
   - socios, grupos_familiares, cuotas, etc. → módulo 'socios'
   - actividades, socios_actividades, etc. → módulo 'actividades'
   - turnos → módulo 'turnos'
   - ventas, clientes, etc. → módulo 'ventas'
   - stock_items, stock_inventario, movimientos_stock, depositos → módulo 'stock'
   - cajas, movimientos_fondos, etc. → módulo 'tesoreria'
   - roles, permisos_modulo, usuarios_roles → módulo 'security'

3. Policy template por tabla:
   CREATE POLICY "read_[tabla]" ON [tabla] FOR SELECT USING (get_user_modulo_permission('[modulo]', 'leer'));
   CREATE POLICY "write_[tabla]" ON [tabla] FOR INSERT WITH CHECK (get_user_modulo_permission('[modulo]', 'escribir'));
   CREATE POLICY "update_[tabla]" ON [tabla] FOR UPDATE USING (get_user_modulo_permission('[modulo]', 'escribir'));
   CREATE POLICY "delete_[tabla]" ON [tabla] FOR DELETE USING (get_user_modulo_permission('[modulo]', 'eliminar'));

Verificar que `supabase db reset` aplica sin errores.
```

**Archivos esperados:**
- `supabase/migrations/20260314000002_rls_policies.sql`

**Verificación:** Un usuario con rol "Solo Lectura" no puede hacer INSERT en ninguna tabla.

---

*Fin del PROMPT_PLAN — ATGQ ERP*
*Total: 9 fases · 33 tareas*
