# PRD — ATGQ ERP

**Asociación de Tiro y Gimnasia de Quilmes**
**Fecha:** 2026-03-14
**Estado:** Borrador inicial

---

## 1. Descripción general

### 1.1 Contexto

La Asociación de Tiro y Gimnasia de Quilmes (ATGQ) opera actualmente un sistema de gestión legacy ("Sistema de Socios y Control Administrativo") en `atygq.sociosonline.ar`. El sistema administra ~8.400 socios y cubre módulos de membresías, actividades, turnos, ventas, stock e inventario, y tesorería.

Este proyecto reemplaza el sistema legacy con una aplicación web moderna, manteniendo toda la funcionalidad existente y mejorando la experiencia de usuario.

### 1.2 Objetivo

Construir un ERP web para ATGQ que replique y mejore el sistema actual, con una arquitectura moderna, base de datos relacional robusta, y una interfaz de usuario limpia y eficiente.

### 1.3 Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend framework | Next.js 14 (App Router) |
| UI Library | React 18 + TypeScript |
| Componentes | shadcn/ui + Tailwind CSS |
| Backend | Next.js Server Actions / API Routes |
| Base de datos | PostgreSQL vía Supabase |
| Auth | Supabase Auth |
| Dev local | Supabase CLI (`supabase start`) |
| Producción | Supabase Cloud |

### 1.4 Setup de desarrollo

```bash
# Inicializar Supabase local
supabase init
supabase start

# Variables de entorno (.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
```

---

## 2. Arquitectura de la aplicación

### 2.1 Layout general

- **Header fijo**: nombre de la organización (izquierda), usuario logueado + fecha (derecha)
- **Navbar horizontal**: menú superior con dropdowns por módulo
- **Workspace con tabs**: cada sección abierta aparece como tab cerrable (×)
- **Contenido principal**: área de trabajo debajo del navbar y tabs

### 2.2 Navegación (módulos del navbar)

```
SOCIOS | ACTIVIDADES | TURNOS | VENTAS | STOCK | TESORERÍA | Security
```

Cada módulo tiene un dropdown con sus sub-secciones.

---

## 3. Módulos

---

### 3.1 SOCIOS

Gestión de membresías del club.

#### Menú dropdown

| Item | Tipo |
|------|------|
| Administración de Socios | Tabla principal |
| Ver Grupos Familiares | Vista |
| Socios Morosos | Vista filtrada |
| CUOTAS | Submenú |
| Padrón | Reporte |
| *(separador)* | |
| Socios por Categorías | Reporte |
| Socios por Edades | Reporte |
| Cuotas cobradas mensualmente | Reporte |
| Socios por Localidad | Reporte |
| Mapas Distribución de Socios | Reporte |
| *(separador)* | |
| Categorías Sociales | Config |
| Tipo de Cuotas | Config |
| Cobranzas | Config |

#### 3.1.1 Administración de Socios

**Vista de tabla con:**
- Paginación: 50 registros por página (total ~8.444)
- Filtro lateral (sidebar) por Categoría con conteo

**Columnas de la tabla:**

| Columna | Descripción |
|---------|-------------|
| Nro Socio | Número único de socio (ej: 10365) |
| Apellido | Apellido del socio (mayúsculas) |
| Nombre | Nombre/s del socio |
| DNI | Documento Nacional de Identidad |
| Categoría | Categoría social asignada |
| Fecha Alta | Fecha de ingreso al club |
| Antigüedad | Calculado automático (Xa Xm Xd) |
| Fecha Baja | Fecha de baja (si aplica) |
| Pagas | Cantidad de cuotas pagas |
| Impagas | Cantidad de cuotas impagas |
| Cobranza | Método de cobro |

**Toolbar de la tabla:**
- Quick search (búsqueda rápida)
- Columns (toggle visibilidad de columnas)
- Search (búsqueda simple)
- Dynamic Search (filtros avanzados)
- Exportar (CSV / Excel)
- + New (crear nuevo socio)
- Persistent State (guardar estado de filtros/columnas)

**Categorías sociales existentes:**

| Categoría | Descripción |
|-----------|-------------|
| Activo | Socio activo regular |
| Activo-Ventanilla | Socio activo con pago en ventanilla |
| Inactivo | Socio sin actividad |
| Cadete | Socio cadete (menor) |
| Cadete-Ventanilla | Cadete con pago en ventanilla |
| Vitalicio | Socio vitalicio |
| Adherente | Socio adherente |
| Adherente-Ventanilla | Adherente con pago en ventanilla |
| Honorario | Socio honorario |
| Grupo Familia | Titular de grupo familiar |
| Grupo Familiar-Ventanilla | Titular grupo familiar, pago en ventanilla |
| Grupo Fliar. Miembro | Miembro de grupo familiar |
| Grupo Fliar. Miembro-Ventanilla | Miembro grupo familiar, pago en ventanilla |
| BAJA | Socio dado de baja |

**Métodos de cobranza:** Efectivo, VISA Crédito (y otros a definir)

#### 3.1.2 Grupos Familiares

Vista de grupos familiares asociados, mostrando titular y miembros del grupo.

#### 3.1.3 Socios Morosos

Vista filtrada de socios con cuotas impagas, ordenada por antigüedad de deuda.

#### 3.1.4 CUOTAS (submenú)

Gestión de cuotas individuales y masivas:
- Ver cuotas de un socio
- Registrar pago de cuota
- Generar cuotas masivas por período

#### 3.1.5 Padrón

Listado oficial de socios activos, exportable.

#### 3.1.6 Reportes

- **Socios por Categorías**: tabla + gráfico de barras con distribución por categoría
- **Socios por Edades**: distribución etaria del padrón
- **Cuotas cobradas mensualmente**: recaudación mensual histórica
- **Socios por Localidad**: distribución geográfica
- **Mapas Distribución de Socios**: visualización en mapa (opcional en v1)

#### 3.1.7 Configuración

- **Categorías Sociales**: ABM de categorías (nombre, descripción, monto base de cuota)
- **Tipo de Cuotas**: tipos de cuotas disponibles
- **Cobranzas**: métodos de cobro habilitados

#### 3.1.8 Esquema de base de datos (SOCIOS)

```sql
-- Categorías sociales
create table categorias_sociales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  monto_base numeric(10,2),
  activa boolean default true,
  created_at timestamptz default now()
);

-- Métodos de cobranza
create table metodos_cobranza (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean default true
);

-- Socios
create table socios (
  id uuid primary key default gen_random_uuid(),
  nro_socio integer not null unique,
  apellido text not null,
  nombre text not null,
  dni text unique,
  categoria_id uuid references categorias_sociales(id),
  fecha_alta date not null default current_date,
  fecha_baja date,
  metodo_cobranza_id uuid references metodos_cobranza(id),
  grupo_familiar_id uuid references grupos_familiares(id),
  localidad text,
  fecha_nacimiento date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Grupos familiares
create table grupos_familiares (
  id uuid primary key default gen_random_uuid(),
  titular_id uuid references socios(id),
  created_at timestamptz default now()
);

-- Tipos de cuotas
create table tipos_cuotas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activo boolean default true
);

-- Cuotas
create table cuotas (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios(id),
  tipo_cuota_id uuid references tipos_cuotas(id),
  periodo date not null, -- primer día del mes
  monto numeric(10,2) not null,
  fecha_pago timestamptz,
  pagada boolean default false,
  metodo_pago_id uuid references metodos_cobranza(id),
  created_at timestamptz default now()
);
```

---

### 3.2 ACTIVIDADES

Gestión de actividades del club (disciplinas deportivas, clases, cursos).

#### Menú dropdown

| Item | Tipo |
|------|------|
| Administración de Actividades | Tabla ABM |
| Generar Cuota de Actividades | Acción masiva |
| Actividades Extras | Tabla ABM |

#### 3.2.1 Administración de Actividades

ABM de actividades del club (tiro, gimnasia, etc.):
- Nombre, descripción, monto de cuota, socios inscriptos
- Listado de socios por actividad

#### 3.2.2 Generar Cuota de Actividades

Proceso masivo para generar cuotas de actividad a todos los socios inscriptos en un período determinado.

#### 3.2.3 Actividades Extras

Actividades especiales o eventos puntuales con cobro independiente.

#### 3.2.4 Esquema de base de datos (ACTIVIDADES)

```sql
create table actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  monto_cuota numeric(10,2),
  activa boolean default true,
  created_at timestamptz default now()
);

create table socios_actividades (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios(id),
  actividad_id uuid not null references actividades(id),
  fecha_inscripcion date default current_date,
  activa boolean default true,
  unique(socio_id, actividad_id)
);

create table actividades_extras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  fecha date,
  monto numeric(10,2),
  created_at timestamptz default now()
);
```

---

### 3.3 TURNOS

Gestión de reservas y turnos de instalaciones del club.

#### Menú dropdown

| Item | Tipo |
|------|------|
| Administrar Turnos | Tabla / Calendario |

#### 3.3.1 Administrar Turnos

- Listado de turnos con filtros por fecha, instalación, socio
- Crear / cancelar turno
- Vista de calendario (opcional v2)

#### 3.3.2 Esquema de base de datos (TURNOS)

```sql
create table instalaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activa boolean default true
);

create table turnos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios(id),
  instalacion_id uuid not null references instalaciones(id),
  fecha_turno date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text default 'confirmado', -- confirmado, cancelado
  created_at timestamptz default now()
);
```

---

### 3.4 VENTAS

Gestión de ventas del club (tienda / kiosco).

#### Menú dropdown

| Item | Tipo |
|------|------|
| Nueva Venta | Formulario |
| Ventas Realizadas | Tabla |
| Clientes | Tabla ABM |
| Items de Ventas | Tabla ABM |
| *(separador)* | |
| Ventas Sumarizadas Mensual | Reporte |
| Ventas Sumarizadas Diaria | Reporte |
| Venta de Item/periodo | Reporte |
| Gráfico de Ventas | Chart |
| Gráfico de Items | Chart |

#### 3.4.1 Nueva Venta

Formulario de punto de venta:
- Seleccionar cliente (puede ser socio o cliente externo)
- Agregar ítems con cantidad y precio
- Calcular total
- Registrar método de pago
- Emitir comprobante

#### 3.4.2 Ventas Realizadas

Historial de ventas con filtros por fecha, cliente, ítem. Permite ver el detalle de cada venta.

#### 3.4.3 Clientes

ABM de clientes externos (no socios):
- Nombre, apellido, DNI, contacto

#### 3.4.4 Items de Ventas

Catálogo de productos vendibles:
- Nombre, descripción, precio, categoría, stock asociado

#### 3.4.5 Reportes

- **Ventas Sumarizadas Mensual**: totales agrupados por mes
- **Ventas Sumarizadas Diaria**: totales agrupados por día
- **Venta de Item/periodo**: ventas de un ítem específico en un rango de fechas
- **Gráfico de Ventas**: línea/barra de evolución temporal de ventas
- **Gráfico de Items**: comparativa de ventas por ítem

#### 3.4.6 Esquema de base de datos (VENTAS)

```sql
create table clientes (
  id uuid primary key default gen_random_uuid(),
  apellido text not null,
  nombre text not null,
  dni text,
  email text,
  telefono text,
  created_at timestamptz default now()
);

create table items_ventas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null,
  activo boolean default true,
  stock_item_id uuid references stock_items(id) -- vinculado a stock si aplica
);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  socio_id uuid references socios(id), -- si el cliente es socio
  fecha timestamptz default now(),
  total numeric(10,2) not null,
  metodo_pago_id uuid references metodos_cobranza(id),
  usuario_id uuid references auth.users(id),
  anulada boolean default false
);

create table ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id),
  item_id uuid not null references items_ventas(id),
  cantidad integer not null,
  precio_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);
```

---

### 3.5 STOCK

Control de inventario del club.

#### Menú dropdown

| Item | Tipo |
|------|------|
| Inventario | Vista agrupada |
| Ingresos / Egresos | Formulario |
| Movimientos de Stock | Historial |
| *(separador)* | |
| Depósitos | Config ABM |

#### 3.5.1 Inventario

Vista agrupada por depósito con columnas: Depósito, Ítem, Cantidad. Total: ~160 ítems.

Toolbar: Group By (agrupar por campo), Exportar.

**Ítems de stock identificados en screenshots:**

*Blancos (targets de tiro):*
- Blanco Carabina neumática
- Blanco Carabina Olímpica cod.3
- Blanco Fusil 1 Zona
- Blanco Fusil 4 zonas
- Blanco Internacional
- Blanco Minirifle FBI
- Blanco pistola neumática
- Blanco Tiro Rápido
- Blancos FBI 2
- Blancos Reducidos fusil

*Cartuchos (munición):*
- Cart. RD Cal 12 - 24 gr. Uso de Línea
- Cart. RD Cal 12 - 28 gr. Uso de Línea
- *(otros calibres/marcas)*

*Otros:*
- Bruselas

**Nota:** Se registraron cantidades negativas en el sistema legacy (ej: Blanco Internacional: -310), lo que indica faltantes o errores de conteo. El nuevo sistema debe manejar alertas de stock negativo.

#### 3.5.2 Ingresos / Egresos

Formulario para registrar entrada o salida de stock:
- Ítem, depósito, cantidad, tipo (ingreso/egreso), motivo, fecha

#### 3.5.3 Movimientos de Stock

Historial completo de movimientos con filtros por ítem, depósito, fecha, tipo.

#### 3.5.4 Depósitos

ABM de depósitos/almacenes del club (ej: Depósito Central).

#### 3.5.5 Esquema de base de datos (STOCK)

```sql
create table depositos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activo boolean default true
);

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  unidad text default 'unidad',
  activo boolean default true
);

create table stock_inventario (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references stock_items(id),
  deposito_id uuid not null references depositos(id),
  cantidad integer not null default 0,
  unique(item_id, deposito_id)
);

create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references stock_items(id),
  deposito_id uuid not null references depositos(id),
  tipo text not null check (tipo in ('ingreso', 'egreso', 'transferencia')),
  cantidad integer not null,
  motivo text,
  referencia_id uuid, -- venta_id u otro origen
  usuario_id uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

### 3.6 TESORERÍA

Control de fondos y movimientos de dinero del club.

#### Menú dropdown

| Item | Tipo |
|------|------|
| Cajas | Tabla ABM |
| Ingresar Movimiento | Formulario |
| Movimientos de Fondos | Historial |
| Transferencias entre cajas | Formulario |
| *(separador)* | |
| Sumarización de Conceptos | Reporte |
| Concepto entre fechas | Reporte |
| Gráfico de Movimientos | Chart |
| Gráfico de Movimientos de Salidas | Chart |
| Categorías movimientos | Config |

#### 3.6.1 Cajas

ABM de cajas registradoras o fondos (ej: Caja Principal, Caja Actividades):
- Nombre, saldo actual, estado (abierta/cerrada)

#### 3.6.2 Ingresar Movimiento

Formulario para registrar ingreso o egreso de fondos:
- Caja, concepto/categoría, monto, descripción, fecha, método de pago

#### 3.6.3 Movimientos de Fondos

Historial de todos los movimientos con filtros por caja, categoría, fecha, tipo (entrada/salida).

#### 3.6.4 Transferencias entre cajas

Formulario para transferir fondos entre cajas internas:
- Caja origen, caja destino, monto, descripción

#### 3.6.5 Reportes

- **Sumarización de Conceptos**: totales agrupados por categoría de movimiento
- **Concepto entre fechas**: movimientos de una categoría en un rango de fechas
- **Gráfico de Movimientos**: evolución temporal de ingresos
- **Gráfico de Movimientos de Salidas**: evolución temporal de egresos

#### 3.6.6 Configuración

- **Categorías movimientos**: ABM de categorías de ingresos/egresos

#### 3.6.7 Esquema de base de datos (TESORERÍA)

```sql
create table cajas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  saldo_inicial numeric(10,2) default 0,
  activa boolean default true,
  created_at timestamptz default now()
);

create table categorias_movimientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  activa boolean default true
);

create table movimientos_fondos (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references cajas(id),
  categoria_id uuid references categorias_movimientos(id),
  tipo text not null check (tipo in ('ingreso', 'egreso', 'transferencia')),
  monto numeric(10,2) not null,
  descripcion text,
  fecha timestamptz default now(),
  caja_destino_id uuid references cajas(id), -- solo para transferencias
  referencia_id uuid, -- venta_id, cuota_id u otro origen
  usuario_id uuid references auth.users(id),
  created_at timestamptz default now()
);
```

---

### 3.7 Security (Usuarios y Roles)

Control de acceso al sistema.

#### Funcionalidades

- Listado de usuarios del sistema
- Crear / editar / desactivar usuarios
- Asignar roles a usuarios
- Definir permisos por módulo por rol

#### Roles base sugeridos

| Rol | Acceso |
|-----|--------|
| Administrador | Acceso total |
| Tesorero | TESORERÍA + VENTAS + STOCK (solo lectura de SOCIOS) |
| Recepcionista | SOCIOS + TURNOS + VENTAS (solo lectura) |
| Solo lectura | Consulta de todos los módulos |

#### Esquema de base de datos (Security)

```sql
-- Roles (además de Supabase Auth)
create table roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text
);

create table permisos_modulo (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references roles(id),
  modulo text not null, -- 'socios', 'actividades', 'turnos', 'ventas', 'stock', 'tesoreria', 'security'
  puede_leer boolean default true,
  puede_escribir boolean default false,
  puede_eliminar boolean default false
);

create table usuarios_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  rol_id uuid not null references roles(id),
  unique(user_id, rol_id)
);
```

---

## 4. Componentes de UI reutilizables

### 4.1 DataTable

Tabla de datos genérica basada en `@tanstack/react-table` + shadcn/ui `Table`:
- Paginación del lado del servidor (Supabase)
- Ordenamiento por columna
- Quick search (búsqueda en tiempo real)
- Filtros dinámicos (Dynamic Search)
- Toggle de visibilidad de columnas
- Exportar a CSV

### 4.2 FacetFilter (sidebar de categorías)

Componente de filtro lateral con conteos:
- Lista de valores únicos con badge de cantidad
- Selección múltiple
- "See All" para expandir lista larga

### 4.3 ModuleTab

Sistema de tabs del workspace:
- Tabs abiertos persistentes durante la sesión
- Cerrar tab con ×
- Navegación entre tabs

### 4.4 StatsChart

Componente de gráfico para reportes usando `recharts` o `chart.js`:
- Tipos: BarChart, LineChart, PieChart
- Filtros de fecha integrados
- Exportar imagen

### 4.5 FormModal

Modal para formularios de creación/edición:
- shadcn/ui `Dialog` + `Form` (react-hook-form + zod)
- Validación del lado del cliente

---

## 5. Fases de desarrollo

### Fase 1 — Scaffold + Base de datos
- Inicializar proyecto Next.js con TypeScript + Tailwind + shadcn/ui
- Configurar Supabase CLI local
- Crear todas las migraciones SQL del esquema
- Configurar Supabase Auth

### Fase 2 — Layout + Autenticación
- Login/logout con Supabase Auth
- Layout principal: header, navbar con dropdowns, sistema de tabs
- Middleware de protección de rutas

### Fase 3 — Módulo SOCIOS (núcleo)
- DataTable de socios con todas las columnas
- Sidebar de filtros por categoría
- Alta / edición de socio
- Vista de grupos familiares
- Gestión de cuotas

### Fase 4 — TESORERÍA
- ABM de cajas
- Ingresar movimiento
- Historial de movimientos
- Transferencias entre cajas
- Reportes y gráficos

### Fase 5 — STOCK
- Inventario agrupado por depósito
- Ingresos/egresos de stock
- Historial de movimientos
- ABM de depósitos e ítems

### Fase 6 — VENTAS
- Punto de venta (Nueva Venta)
- Historial de ventas
- ABM de clientes e ítems
- Reportes y gráficos

### Fase 7 — ACTIVIDADES + TURNOS
- ABM de actividades
- Inscripción de socios a actividades
- Generación masiva de cuotas
- Gestión de turnos

### Fase 8 — Reportes y Gráficos
- Reportes avanzados de SOCIOS (por categoría, edad, localidad)
- Gráficos de VENTAS y TESORERÍA
- Exportación de reportes

### Fase 9 — Security / RBAC
- ABM de usuarios
- Gestión de roles y permisos
- Integración con Supabase Auth (RLS policies)

---

## 6. Notas y consideraciones

### 6.1 Migración de datos

- El sistema legacy tiene ~8.400 socios activos
- Se deberá diseñar un script de migración desde el sistema actual
- Verificar integridad de grupos familiares y cuotas históricas

### 6.2 Stock negativo

- El sistema legacy muestra cantidades negativas (ej: Blanco Internacional: -310)
- Implementar alerta visual para stock en cero o negativo
- Decidir si bloquear egresos que generen stock negativo

### 6.3 Numeración de socios

- El número de socio (`nro_socio`) es secuencial y llega a ~10.365
- Debe ser generado automáticamente al crear nuevo socio (siguiente disponible)

### 6.4 Localización

- Idioma: español (Argentina)
- Formato de fechas: DD/MM/YYYY
- Formato de moneda: ARS con separador de miles `.` y decimal `,`
- Zona horaria: America/Argentina/Buenos_Aires

### 6.5 Antigüedad

- Campo calculado en base a `fecha_alta - fecha_actual`
- Formato: `Xa Xm Xd` (años, meses, días)
- Mostrar en tabla, no almacenar en DB

---

## 7. Criterios de aceptación por módulo

| Módulo | Criterio mínimo |
|--------|----------------|
| SOCIOS | Listar, crear, editar socios; registrar pago de cuota |
| ACTIVIDADES | Listar actividades; inscribir socios; generar cuotas |
| TURNOS | Crear y consultar turnos por fecha |
| VENTAS | Registrar venta; ver historial; ver totales diarios |
| STOCK | Ver inventario por depósito; registrar ingreso/egreso |
| TESORERÍA | Registrar movimiento; ver saldo de cajas; transferir |
| Security | Login/logout; control de acceso por módulo |
