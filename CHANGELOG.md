# CHANGELOG — ATGQ ERP

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).
Versiones según [Semantic Versioning](https://semver.org/lang/es/).

---

## [Unreleased]

### Security

Remediación del export de advisories de Sentinello del 2026-08-04 (41 hallazgos: 20 high, 19 moderate, 2 low). Estado final: **40 cerrados, 1 residual documentado**, más 1 hallazgo nuevo detectado y cerrado durante el trabajo. `npm audit` → `found 0 vulnerabilities`.

- **Lockfiles unificados en npm.** El repo tenía `package-lock.json` versionado y `pnpm-lock.yaml` + `pnpm-workspace.yaml` sin versionar, con `node_modules` instalado por pnpm. Los dos lockfiles divergían y el escáner leyó ambos, que es por qué había hallazgos duplicados del mismo paquete en versiones distintas (`brace-expansion` #1/#21/#22 venían de npm, #2/#3 de pnpm). Se eliminan los artefactos de pnpm: `package-lock.json` es lo único que ve Vercel, así que el deploy no cambia de instalador.

- **Transitivos refrescados dentro de sus rangos** (12 hallazgos, sin cambios de código ni overrides): `brace-expansion` 5.0.4→5.0.9 y 1.1.12→1.1.18, `flatted` 3.4.1→3.4.4, `js-yaml` 4.1.1→4.3.1, `picomatch` 4.0.3→4.0.5. `ws` (CVE-2026-48779, GHSA-58qx-3vcg-4xpx) desaparece del árbol al subir `@supabase/supabase-js` 2.99.1→2.112.0 dentro de `^2.99.1`, que sustituyó `ws` por `@supabase/phoenix`. Update quirúrgico y no `npm update` global: este último movía 142 paquetes incluyendo `recharts`, `react-hook-form`, `immer` y `zod`, cambios de runtime ajenos a seguridad.

- **Next 14.2.35 → 15.5.22** (22 hallazgos: los 21 de `next` más `glob@10.3.10`). No hay parche en la línea 14.x — el dist-tag `next-14` es exactamente 14.2.35, así que el salto de major era obligatorio. Se elige 15.5.22 (tag `backport`) y no 16.x porque cubre el máximo exigido (15.5.21) con la mínima superficie: **React sigue en 18**, ya que `next@15.5.22` acepta `peerDependency react ^18.2.0`. `glob` se cierra por upgrade del padre, sin override: `@next/eslint-plugin-next@15.5.22` lo eliminó en favor de `fast-glob`. Migración de APIs async: `createClient()` pasa a `async` con `await cookies()` y se propaga el `await` a 137 call sites en 50 archivos (sólo los que importan de `@/lib/supabase/server`; el cliente de navegador y `createAdminClient()` no cambian); `params` pasa a `Promise` en `security/roles/[id]`.

- **Override `postcss` → 8.5.23** (4 hallazgos). Único caso sin vía de padre: `next@15.5.22` pinnea `postcss: "8.4.31"` de forma exacta. Se usa 8.5.23 porque es la versión que `next@16.3.0` declara, o sea una combinación ya validada por los mantenedores de Next. Es dev-only (postcss sólo corre en build). Evidencia de no-regresión: el CSS generado es byte a byte idéntico al de 8.4.31.

- **`xlsx` reemplazado por `write-excel-file` 4.1.1** (2 hallazgos high). Ni upgrade ni override eran posibles: las versiones del fix (0.19.3, 0.20.2) **no existen en npm** — SheetJS dejó de publicar en el registry a partir de 0.18.5 y sólo distribuye por su CDN. Sólo cambia `src/lib/export.ts`; la firma de `exportToExcel` se conserva y los 15 call sites no se tocan. Se preservan los tipos numéricos por celda (volcarlos como texto habría roto ordenamientos y sumas en Excel de forma silenciosa).

- **Override `sharp` → 0.35.3** (GHSA-f88m-g3jw-g9cj, high). Hallazgo **nuevo**, no presente en el export: lo introdujo el propio upgrade a Next 15, que declara `sharp` como `optionalDependency ^0.34.3`. Se fuerza 0.35.3, la mínima que declara `next@16.3.0`. Verificado ejecutando la cadena exacta del optimizador de Next (`sharp().rotate().resize().toFormat().toBuffer()`) en jpeg, png, webp y avif.

**Overrides y sus disparadores de retirada.** El proyecto no tenía ningún override antes de este trabajo. Los dos que se añaden quedan justificados en `package.json` bajo `overridesNotes` (JSON no admite comentarios). Ambos se retiran al migrar a Next 16.x, que ya trae `postcss >= 8.5.23` y `sharp >= 0.35.3`.

**Residual abierto (1).** `eslint@8.57.1` (#23, moderate, `GHSA-p5wg-g6qr-c7cg` / CVE-2025-50537): es un **Withdrawn Advisory** retirado por GitHub, y su fix exige eslint 9, que obliga a migrar `.eslintrc.json` a flat config. `eslint-config-next@15.5.22` soporta eslint 8, así que no bloquea nada. Revisar si GitHub re-publica el advisory como vigente o cuando se toque el tooling de lint.

### Added

- **Eliminar registros en cuatro ABM de catálogo**: Ventas → Ítems de Ventas, Stock → Depósitos, Stock → Puntos de Venta y Tesorería → Cajas. Hasta ahora sólo se podía crear y editar, así que un registro cargado por error quedaba para siempre. No hizo falta migración: las políticas `delete_items_ventas`, `delete_depositos` y `delete_cajas` ya existían desde `20260314000009`; faltaba únicamente la capa de aplicación.
  - **El borrado con historial se bloquea con un mensaje concreto**, no se cascadea. Todas las FKs entrantes son NO ACTION, así que se cuentan los dependientes antes (`ventas_items` para un ítem; `ventas`, `movimientos_stock` origen/destino y `stock_inventario` para una ubicación; `movimientos_fondos` origen/destino y los puntos de venta vinculados para una caja) y se sugiere desactivar en su lugar. El `23503` de Postgres queda mapeado igual como red final: los conteos corren con el cliente del usuario y RLS puede ocultarle filas de otro módulo —un rol a medida con `tesoreria.eliminar` pero sin `stock.leer` cuenta 0 puntos de venta—, así que un `count` nulo o invisible **falla cerrado** y, si aun así pasa, la integridad la garantiza la base.
  - Un depósito vacío conserva filas de `stock_inventario` en cero (los RPC hacen upsert y nunca las borran), y esas filas bloquean la FK aunque la pantalla muestre "0 ítems en stock". Se limpian antes de borrar la ubicación, con `cantidad = 0` en el filtro: los dos borrados no comparten transacción, así que el filtro es lo que garantiza que una carga concurrente no se pierda. El guard usa `cantidad <> 0` y no `> 0` porque `stock_inventario` no tiene CHECK y los RPC permiten negativos a propósito — un negativo es justo la diferencia que hay que conservar, no una fila vacía.
  - Depósitos y puntos de venta son la misma tabla `depositos` discriminada por `tipo`, así que comparten `deleteUbicacion` (`src/app/(dashboard)/stock/ubicaciones.ts`, módulo plano sin `"use server"` para que no quede expuesto como endpoint). La fila se resuelve acotada por `tipo` **antes** de tocar nada: sin eso, el ABM de depósitos podía limpiar el inventario de un punto de venta pasándole un id de la otra pantalla.
  - En la UI, botón de papelera junto al de editar y `AlertDialog` de confirmación (el mismo patrón que "Anular Venta"). Ante un bloqueo el diálogo **queda abierto** para que se lea el motivo en el toast. El borrado que RLS deniega no devuelve error sino cero filas, así que se usa `.select("id")` y se avisa "no tiene permisos" en vez de mostrar un falso éxito.
  - **Los motivos se devuelven, no se tiran.** En un build de producción Next redacta el mensaje de cualquier `Error` que escape de un server action, y el cliente recibe *"An error occurred in the Server Components render..."* — o sea que el usuario veía ese genérico en vez de saber por qué no se podía borrar. Las cuatro acciones devuelven `{ error?: string }` (la convención que ya usaba `src/app/login/actions.ts`, y la que prescribe la doc de Next: *"model expected errors as return values"*), y además loguean el error crudo con `console.error` para que quede en los logs de Vercel. Verificado corriendo `next build` + `next start`: los mensajes ahora llegan intactos. **Las ~53 `throw new Error("…")` restantes en los otros 20 `actions.ts` siguen con este problema** — es deuda preexistente, no se tocó en este cambio.

- **Ventas a NO SOCIO con credencial de legítimo usuario** (migración `20260805000001`). En el POS (`/ventas/nueva`) el toggle "Tipo de cliente" pasa de **Socio | Cliente** a **Socio | No Socio**. El desplegable de `clientes` desaparece del mostrador: obligaba a tener la ficha cargada de antemano, algo que no pasa con el tirador ocasional. Ventas → Clientes queda como está para consultar el histórico ya asociado a `cliente_id`.
  - Tres campos libres, **los tres obligatorios**: nombre y apellido, DNI y vencimiento de la credencial de legítimo usuario (ANMaC). Se guardan en columnas nuevas de `ventas` (`no_socio_nombre`, `no_socio_dni`, `no_socio_credencial_vencimiento`) y **no** crean ficha en `clientes`: es un ocasional, no un cliente recurrente. El DNI se normaliza sacando los puntos y recién ahí se exige 7 u 8 dígitos —así "30.123.456" y "30123456" quedan guardados igual— y el vencimiento se valida con `z.iso.date()`, que rechaza fechas inexistentes (`9999-99-99`, `2027-02-29`): es una constancia regulatoria, un "no tengo" tipeado ahí no sirve.
  - Constraint `ventas_no_socio_completo` (los tres o ninguno) y trigger `trg_ventas_comprador_guard` (BEFORE INSERT OR UPDATE) que exige comprador y credencial vigente. El trigger no es capricho: un `CHECK ... NOT VALID` saltea las filas existentes **sólo al crearse** y después se evalúa en cada UPDATE, así que habría roto `anular_venta` sobre toda venta histórica sin comprador — 11 de las 20 del sandbox local, y presumiblemente las importadas del legacy en producción. El trigger sí puede mirar `OLD` y dejar pasar lo que ya venía mal sin habilitar casos nuevos; el vencimiento se chequea sólo en el INSERT, porque si no anular una venta vieja fallaría cuando esa credencial ya venció. Además cierra el `POST`/`PATCH` directo a `/rest/v1/ventas`, que RLS habilita a cualquiera con `ventas:escribir`.
  - **Credencial vencida bloquea la venta**, en el cliente y de nuevo en `registrar_venta`. La comparación usa `(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date` y no `CURRENT_DATE`: la sesión de Postgres corre en UTC, así que a partir de las 21:00 ART una credencial que vence hoy daría por vencida. El mismo motivo detrás del helper `todayISO()` de `src/lib/format.ts`, que usa el server de Vercel (también en UTC) y el browser.
  - `registrar_venta` suma tres parámetros y **cambia de firma**: hay que DROPear la versión de 5 argumentos, si no PostgREST queda con dos overloads ambiguos. Si llega socio o cliente, los datos de no socio se descartan en vez de mezclarse. El resto (precios autoritativos, egreso de stock del PdV, ingreso en su caja, atomicidad) no cambia.
  - El no socio se muestra como `"<nombre> (No socio)"` en Ventas Realizadas y en el reporte Venta de Ítem; el detalle desplegable agrega DNI y vencimiento de la credencial, y la exportación CSV/Excel suma las columnas "DNI No Socio" y "Venc. Credencial L.U." — una constancia que no se puede consultar en lote no sirve como constancia.

### Fixed

- **Métricas del dashboard: sumas truncadas a 1000 filas, mes corrido por zona horaria y "Socios Activos" que contaba las bajas.** Los tres KPIs monetarios traían filas con `.select()` sin `.range()` y sumaban en JS; PostgREST corta en `max_rows` (1000, mismo default en Supabase Cloud), así que cualquier mes con más de 1000 movimientos quedaba **subestimado en silencio**. Verificado con 1500 movimientos de $10 en el mes: el código viejo reportaba $10.000 donde la verdad era $15.000. El gráfico de 6 meses era el peor caso — una sola query sin `ORDER BY` para toda la ventana, cortada a 1000 filas en orden arbitrario.
  - Todo se agrega ahora en SQL vía `get_dashboard_metrics()` (migración `20260806000001`), que además calcula los límites de mes en `America/Argentina/Buenos_Aires`. Antes salían de `new Date(y, m, 1).toISOString()`, que usa el huso del **proceso**: en Vercel (UTC) el mes arrancaba a las 21:00 del último día del mes anterior.
  - **"Socios Activos" contaba `fecha_baja IS NULL` a secas.** En los datos migrados del legacy el estado real vive en la categoría social — existe una categoría literal `BAJA` — y los dos criterios no están sincronizados, así que el KPI incluía socios dados de baja por categoría. Se agrega `categorias_sociales.cuenta_como_activo` (regla editable desde el ABM de categorías, no un nombre hardcodeado en las queries) y el KPI pasa a exigir ambas condiciones. Las variantes "-Ventanilla" cuentan como socios.
  - **Cada tarjeta enlazaba a una pantalla que mostraba otro número.** "Cuotas Impagas (mes)" contaba *cuotas* del mes en curso pero llevaba a `/socios/morosos`, que cuenta *socios* con cualquier cuota impaga: distinta unidad y distinta ventana. Ahora es "Socios Morosos", con el mismo predicado que `get_socios_morosos_count()`. "Socios Activos" lleva a `/socios?estado=activos`, un filtro Estado nuevo (Todos / Activos / Bajas) que devuelve exactamente el número de la tarjeta. Cada tarjeta declara debajo qué mide.
  - "Recaudación (mes)" pasa a llamarse "Resultado Neto (mes)": siempre fue `ingresos − egresos`, no recaudación. "Stock Crítico" pasa a "Sin Stock" — no existe `stock_minimo` en el esquema, así que "crítico" no estaba definido; lo que cuenta son filas de inventario en cero, por depósito. En el gráfico, los meses con pérdida se pintan en `--destructive`: en verde se leían como un resultado positivo más.

- **Venta duplicada al cerrar con Escape el diálogo de "Venta registrada"** (`/ventas/nueva`). `onOpenChange` sólo cerraba el diálogo: el carrito y el comprador quedaban cargados y un segundo clic en Confirmar registraba la misma venta otra vez, con el stock descontado y el ingreso en caja por duplicado. Ahora cerrar por cualquier vía limpia la pantalla, igual que el botón "Nueva Venta". Bug preexistente, encontrado revisando el cambio de no socio.

- **Modo claro / oscuro con selector en el header.** La infraestructura ya estaba puesta desde el principio (`darkMode: ['class']` en Tailwind, bloques `:root`/`.dark` en `globals.css`, `next-themes` en `package.json`) pero nunca se había montado un `ThemeProvider`, así que la clase `.dark` no llegaba nunca al DOM — el efecto secundario era que `ui/sonner.tsx` leía un `useTheme()` sin proveedor y siempre resolvía al default `"system"`.
  - `ThemeProvider` (`src/components/shared/ThemeProvider.tsx`) montado en el layout raíz con `attribute="class"`, `defaultTheme="system"`, `enableSystem` y `disableTransitionOnChange`; `suppressHydrationWarning` en `<html>` porque el script inline de `next-themes` muta `classList` antes de hidratar. Al ser raíz, también cubre `/login`, que está fuera de `(dashboard)`.
  - `ThemeToggle` (`src/components/shared/ThemeToggle.tsx`): dropdown Claro / Oscuro / Sistema, ubicado en `AppHeader` junto al botón de logout. No necesita guard de montaje — el intercambio Sol/Luna es por CSS (`dark:`) y ambos íconos están siempre en el DOM, y `value={theme ?? "system"}` coincide entre servidor y primer render del cliente.

- **P10.1** — Punto de Venta y transferencias de stock entre ubicaciones:
  - **Modelo**: `depositos` pasa a ser la tabla de *ubicaciones de stock*, con `tipo IN ('deposito','punto_venta')` y `caja_id` opcional. Un punto de venta **es** una fila de `depositos`, así `stock_inventario` y `movimientos_stock` sirven para ambos sin tocar sus FKs. Seed de los PdV reales del legacy: `Secretaria` y `Tiro Practico` (`Deposito Central` sigue siendo depósito).
  - **`ventas.punto_venta_id`** NOT NULL (FK a `depositos`), con backfill de las ventas existentes al PdV por defecto. Nuevo índice `(punto_venta_id, fecha)`.
  - **ABM Puntos de Venta** (`/stock/puntos-venta`): alta/edición con caja asociada y contador de ítems en stock; `/stock/depositos` queda filtrado a `tipo = 'deposito'`.
  - **Transferencias de Stock** (`/stock/transferencias`): mover existencias en cualquier dirección entre depósitos y puntos de venta, con formulario + listado de últimas transferencias y stock disponible en origen.
  - **POS** (`/ventas/nueva`): selector de Punto de Venta obligatorio que recuerda la última elección en `localStorage` (el cajero trabaja un sector todo el turno). El stock se descuenta **del punto de venta**, no de un depósito fijo.
  - **Ventas ↔ Tesorería**: cada venta genera un ingreso en la caja asociada al PdV (categoría `Ventas`, todos los métodos de pago). Primera relación venta→caja del sistema.
  - **Listado de Ventas**: columna y filtro de Punto de Venta, incluido en exportación CSV/Excel.
  - **Reportes de VENTAS**: filtro por Punto de Venta en mensual, diaria, gráfico de ventas, venta por ítem (además de columna en la tabla) y gráfico de ítems.
  - **Movimientos de Stock**: nueva columna `deposito_destino_id` y columna "Destino" en la grilla; el filtro "Depósito" pasa a "Ubicación" y agrupa por tipo.
  - **Inventario** (`/stock`): los grupos distinguen Depósito (azul) de Punto de Venta (verde) y el tipo se incluye en la exportación.
  - **Pipeline de migración legacy** (`migration/migrate.py`): `mig_depositos` clasifica los depósitos legacy en depósito/punto de venta, `mig_ventas` asigna un PdV por defecto (el legacy `VentasCabecera` no tiene columna de sector) y `mig_movimientos_stock` deja de descartar `idDeposito_Destino`.

### Changed

- **Buscador obligatorio en todo selector de ítems.** Los 6 selectores de ítems de la app —`items_ventas` y `stock_items`— eran un `<Select>` plano: para cargar una venta había que scrollear el catálogo entero, porque Radix sólo ofrece type-ahead sobre las primeras letras. Pasan a un combobox buscable (`shared/Combobox` sobre `cmdk` + Popover, ambos ya instalados y hasta ahora sin usar, así que no entran dependencias nuevas) con los wrappers de dominio `ItemVentaCombobox` / `StockItemCombobox`. Sitios migrados: POS, reporte "Venta de Ítem por Período", stock vinculado del ABM de ítems, alta de movimiento de stock, filtro de movimientos y transferencias. Queda como regla en `CLAUDE.md` → `## Conventions`.
  - **El filtro no es el de cmdk.** cmdk puntúa contra el prop `value`, que acá es el uuid del ítem (obligatorio: `items_ventas.nombre` no es único y sin él dos ítems homónimos comparten identidad de resaltado y selección), así que el filtro por defecto no matchearía nada. Se filtra por `keywords` normalizadas —sin acentos, para que "municion" encuentre "Munición"— exigiendo todos los términos y priorizando prefijos: en un mostrador "cart" tiene que traer "Cartucho" primero, no un fuzzy impredecible. Busca por nombre, descripción y nombre del stock vinculado, que es todo el texto que hay (`items_ventas` no tiene código ni rubro).
  - **`defaultValue` en el `<Command>`, que no es cosmético.** Sin eso cmdk resalta siempre la primera fila del catálogo, y como Radix desmonta el popover al cerrar, pasaba en cada apertura: un Enter reflejo sobre un combo que *ya tenía* ítem elegido lo cambiaba en silencio por el primero alfabético — en el POS, cargar mal la venta. El `<Select>` anterior re-seleccionaba el valor actual y no tenía ese filo.
  - **La fila que limpia ("Todos", "Sin vínculo") puntúa en una banda más baja que las coincidencias reales.** Va primera para encontrarse sin scrollear, pero con el mismo puntaje ganaba los empates —el sort es estable— y tipear "s" + Enter limpiaba el filtro en vez de elegir el primer resultado. Se probó antes montarla/desmontarla según el conteo de resultados: eso dejaba el Enter *muerto*, porque cmdk no vuelve a resaltar nada cuando la fila resaltada se desmonta.
  - Los centinelas `"none"` y `"all"` desaparecen de los dos sitios opcionales: el combo entrega `null` directamente. `sinFiltro()` sobrevive en `stock/movimientos` porque los filtros de Ubicación y Tipo lo siguen usando.
  - Accesibilidad: el `<Label>` de cada sitio queda asociado al control vía `id`/`htmlFor` (con el `<Select>` la asociación ya estaba rota y el lector anunciaba tres filtros seguidos sin decir cuál era cuál); región `aria-live` con el conteo de resultados; texto `sr-only` "Seleccionado" (en cmdk `aria-selected` significa "resaltado", no "elegido"); íconos con `aria-hidden`; y textos del listbox en español en vez del "Suggestions" que trae cmdk. Tab cierra el popover explícitamente: sin eso Radix lo dismisseaba por interacción externa y dejaba el foco en `<body>`, perdiendo el lugar dentro de los formularios de stock.

- **Catálogos de ítems truncados en 1000 filas.** Ninguna de las 7 acciones que alimentan esos combos usaba `.range()`, así que PostgREST las cortaba en silencio: no fallaban, simplemente devolvían menos ítems de los que existen. Se agrega `fetchAllRows()` (`src/lib/supabase/fetch-all-rows.ts`), que pagina hasta agotar, con `.order("nombre").order("id")` — sin ese desempate, paginar sobre un `nombre` no único puede duplicar o saltear filas entre páginas. Verificado contra la base local con 1215 ítems: la consulta vieja devolvía 1000 y escondía 215; la nueva los trae todos. Es la misma clase de bug que `a157a47` cerró en el dashboard. El helper avanza por la cantidad de filas que el servidor devolvió y corta con una página vacía, en vez de asumir que `max-rows` es 1000: con un tope menor, cortar por "página incompleta" reintroduciría el truncamiento a un techo todavía más bajo.
  - Se cierran además dos truncamientos de la misma clase que estaban a la vista: `getVentasPorItem`, donde los totales del reporte ("Total: N unidades = $X") se calculan en JS sobre las filas traídas y un ítem de alta rotación los dejaba cortos; y `getStockItems`, el más dañino de los dos porque `stock_inventario` tiene una fila por (ítem, ubicación) y supera las 1000 mucho antes que el catálogo: los ítems que caían del otro lado del corte mostraban `stock_total` en 0 o entendido, que en la pantalla de Inventario se lee como stock real. De paso se elimina el `.in("item_id", [...])` con 1000+ uuids, que era además un riesgo de largo de URL. **Siguen abiertos** los truncamientos de tesorería y de los demás reportes de ventas que `a157a47` ya había señalado.
  - De paso, `getItemsVentasParaFiltro` (reporte por ítem) amplía su `select` a `descripcion` y `activo` para que la búsqueda cubra la descripción y los ítems dados de baja se muestren marcados. Sigue deliberadamente **sin** filtrar por `activo`: un reporte histórico necesita los discontinuados.

- **Ventas → Clientes sale del menú.** Desde que el POS usa "No Socio" no queda ningún camino para asociar una ficha de `clientes` a una venta nueva, así que la pantalla sólo mostraría un padrón con "Cant. Compras" y "Total Comprado" congelados. La ruta `/ventas/clientes` sigue viva para consultar el histórico, y `ventas.cliente_id` se conserva para las ventas ya cargadas.

- **Tokenización de colores de estado y tematizado de gráficos** (acompaña al modo oscuro):
  - Tokens nuevos en `globals.css` + `tailwind.config.ts`: `--success`, `--warning`, `--info` (con sus `-foreground`) y `--chart-1..5`, con valores distintos por tema — oscuros en claro (L≈26–42%) y claros en oscuro (L≈52–70%). Los badges usan el patrón `bg-<token>/15 text-<token>`, que se auto-invierte por tema y evita duplicar cada clase con una variante `dark:`. **Los valores se calculan contra el fondo compuesto más exigente, no contra el fondo plano**: en claro es el propio tinte al 15% sobre `bg-muted/30`, y en oscuro el tinte al 15% sobre `bg-card`. Peor caso resultante: 4.54:1 en claro y 4.69:1 en oscuro (AA para texto normal).
  - **`--destructive` corregido**: el valor heredado de shadcn para `.dark` (`0 62.8% 30.6%`) es un rojo casi negro, inservible como color de texto sobre fondo oscuro. Pasa a `0 84% 70%` en oscuro y `0 72% 43%` en claro, con `--destructive-foreground` oscuro en dark. Esto era condición previa para migrar los ~58 mensajes de validación a `text-destructive`.
  - `--muted-foreground` en claro pasa de `45.1%` a `42%`: al 45.1% da 4.35:1 sobre `bg-muted`, que es el fondo de la tira de tabs (el valor de shadcn está calibrado sólo contra `--background`). Ahora 4.88:1.
  - **Paleta oscura escalonada**: shadcn deja `--background` y `--card` ambos en `0 0% 3.9%`, con lo que las cards son invisibles. Pasan a 7% y 12% respectivamente, para conservar en oscuro la misma jerarquía que en claro (card por encima del `bg-muted/30` del `<main>`).
  - **Gráficos**: `src/lib/chart-theme.ts` centraliza grilla, ejes, tooltip, cursor y `activeDot`. Los ejes y las marcas de tick usan `--muted-foreground` y no `--border`: el borde da 1.26:1 sobre la card en claro, *peor* que el `#666` (5.74:1) que Recharts trae por defecto — usar el token "obvio" habría sido una regresión. `--border` queda sólo en la grilla, donde la sutileza es lo buscado. Los 8 gráficos Recharts tenían `CartesianGrid`/`XAxis`/`YAxis`/`Tooltip` sin estilar, heredando los defaults claros de la librería (grilla `#ccc`, ejes `#666`, tooltip blanco) — ilegibles en oscuro. Los hex fijos de las series pasan a `--chart-N` conservando el mapeo semántico (azul=ventas, verde=ingresos, rojo=egresos, violeta=edades).
  - **Barrido de ~99 utilitarios hardcodeados** a tokens en 49 archivos. El header (`bg-slate-800`) y la navbar (`bg-[#1e3a5f]`) se conservan como color de marca fijo en ambos temas; sí se corrigen los `hover:bg-slate-100` del `Sheet` móvil, que están dentro de `bg-background` y por lo tanto sí deben seguir al tema.

- **RPCs atómicas reemplazan escrituras secuenciales** (migración `20260803000002`):
  - `transferir_stock(...)` (SECURITY INVOKER): las dos patas del movimiento y los dos ajustes de inventario en una sola transacción, con orden de bloqueo determinístico para evitar deadlocks entre transferencias cruzadas. No bloquea por stock insuficiente: permite negativo y devuelve el saldo para avisar.
  - `registrar_venta(...)` (SECURITY DEFINER, re-chequea `ventas:escribir`): cabecera, ítems, egreso de stock del PdV e ingreso en caja en una transacción. Reemplaza las 5–9 escrituras no transaccionales de `crearVenta`. Los **precios ahora los resuelve el servidor** desde `items_ventas` en vez de confiar en el payload del browser. Permite a un Recepcionista (sin permisos de stock/tesorería) causar esos efectos sin darle escritura amplia sobre esos módulos.
  - `anular_venta(...)` (SECURITY DEFINER): **corrige una fuga de inventario preexistente** — la anulación sólo marcaba `anulada = true` y nunca restituía el stock. Ahora inserta contramovimientos de ingreso en la misma ubicación del egreso original y compensa el ingreso en caja con un egreso (categoría `Anulación de Ventas`, fechado `now()`, ledger append-only). Guard contra doble anulación.
- **Zod del POS**: `nuevaVentaSchema` era código muerto (nadie lo importaba); ahora `crearVenta` lo parsea efectivamente. Incluye `punto_venta_id` y ya no lleva `precio_unitario`.
- **Hardcodes de `'Deposito Central'` eliminados**: en `ventas/nueva/actions.ts` (ahora es el PdV elegido en el POS) y en `stock/items/actions.ts` (ahora es un selector de ubicación en el formulario, con fallback al primer depósito activo).
- **RLS**: `select_depositos` permite a lectores de `ventas` ver los puntos de venta (no los depósitos internos); `select_cajas` permite a usuarios con `stock:escribir` listar cajas para el selector del ABM de PdV.
- **Seeds**: `supabase/seed.sql` crea los dos puntos de venta; `supabase/seeds/demo_bonus.sql` asigna `punto_venta_id` a las 20 ventas demo y las reparte entre ambos PdV.
- **Ajuste sobre datos reales** (migración `20260803000004`): la base productiva importada del legacy tiene un cuarto sector (`Arma Corta`) que `…000001` no contemplaba, y no tiene ninguna caja llamada `Caja Principal`. La migración reclasifica `Arma Corta` a `punto_venta` y vincula cada PdV con la caja de tesorería homónima. `Tiro Practico` queda sin caja (no existe una con ese nombre): registra ventas y descuenta stock, pero no genera movimiento de fondos hasta que se le asigne una.

### Fixed

- `stock/movimientos` — los filtros de Ítem/Ubicación/Tipo enviaban el centinela `"all"` como valor real a la query, rompiendo el filtrado.

### Added

- **Buscadores en todas las secciones con tablas/listas** — toda sección con tabla o lista ahora ofrece buscador o filtro por identificador y descripción (según corresponda):
  - Listas ABM/config (búsqueda cliente por nombre/descripción vía `DataTable onSearch` + `useMemo`): `socios/config/{categorias,tipo-cuotas,cobranzas}`, `actividades`, `actividades/extras`, `ventas/items`, `stock/{items,depositos}`, `tesoreria/cajas`, `tesoreria/config/categorias`, `security/roles` (nombre/descripción), `security/usuarios` (email/rol)
  - Tablas planas / agrupadas (buscador `Input` dedicado): `socios/grupos-familiares` (por titular), `socios/padron` (texto, junto al filtro de categoría existente), `stock` inventario (por ítem/unidad/depósito), `actividades/[id]` inscriptos (nro/apellido/nombre), `socios/[id]/cuotas` (período/tipo/método/estado), `socios/[id]/actividades` (actividad)
  - `socios/morosos`: migrado de paginación server a carga completa (`getAllMorosos`) con búsqueda y paginación en cliente (nro/apellido/nombre/DNI/categoría); export ahora respeta el filtro
  - Secciones ya provistas de búsqueda/filtros no modificadas: `socios`, `ventas`, `ventas/clientes`, `turnos`, `stock/movimientos`, `tesoreria/movimientos` y los reportes (filtros de fecha/categoría)
  - Fix incidental: `socios/grupos-familiares` — `key` de React movido al `Fragment` del `.map` (antes en los `TableRow` internos)

- **P9.1** — ABM Usuarios del Sistema (`/security/usuarios`):
  - Admin client (`src/lib/supabase/admin.ts`) using `SUPABASE_SERVICE_ROLE_KEY` for user management
  - Permission helpers (`src/lib/permissions.ts`): `getUserPermissions()`, `isAdmin()`, `hasPermission()`
  - Security types (`src/types/security.ts`): Role, PermisoModulo, UsuarioSistema, UserPermissions, MODULOS const
  - Zod schemas (`src/lib/schemas/security.ts`): usuarioSchema, rolSchema
  - DataTable: Email, Rol (Badge), Último acceso, Estado (Activo/Inactivo), Acciones (Editar rol, Ban/Unban)
  - UsuarioForm: create user with email + password + rol, edit role assignment
  - Security layout with `isAdmin()` guard + bootstrap mode (allows access when no roles assigned)
  - Bootstrap migration: auto-assigns Administrador role to first auth user
  - Navbar permission filtering: modules filtered by `puede_leer` permission
  - Dashboard layout: loads user permissions server-side, shows "Sin rol asignado" message for users without roles

- **P9.2** — ABM Roles y Permisos (`/security/roles`):
  - DataTable: Nombre, Descripción, Usuarios (count), Acciones (Editar, Ver Permisos, Eliminar)
  - RolForm: FormModal for create/edit role with nombre + descripcion
  - Role detail page (`/security/roles/[id]`): PermisosMatrix component
  - PermisosMatrix: 7×3 checkbox grid (modules × leer/escribir/eliminar) with cascade logic
  - Cascade: Eliminar→auto-check Escribir+Leer; Escribir→auto-check Leer; uncheck Leer→uncheck all
  - Protected roles: Administrador, Tesorero, Recepcionista, Solo Lectura cannot be deleted
  - Custom roles can only be deleted if no users are assigned

- **P9.3** — Supabase RLS Policies:
  - SQL helper function `get_user_modulo_permission()` (SECURITY DEFINER, bypasses RLS for circular dependency)
  - Performance index on `usuarios_roles(user_id)`
  - Replaced 25 permissive `authenticated_all` policies with 100 granular RBAC policies (4 per table × 25 tables)
  - Each table has SELECT (leer), INSERT (escribir), UPDATE (escribir), DELETE (eliminar) policies
  - `stock_items` has dual-module SELECT (stock OR ventas) since it's shared between modules
  - Admin operations via service role client bypass RLS as intended

### Changed

- `src/lib/nav-config.ts` — Added `modulo` field to `NavModule` type for permission filtering
- `src/components/shared/AppNavbar.tsx` — Accepts `permissions` prop, filters modules by `puede_leer`
- `src/app/(dashboard)/layout.tsx` — Server-side permission loading, "sin rol" message for unassigned users

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
