/**
 * Estilos compartidos para los gráficos Recharts.
 *
 * Recharts pinta atributos de presentación SVG y objetos de estilo inline, y
 * ambos resuelven `hsl(var(--x))` nativamente en el navegador — por eso alcanza
 * con constantes y no hace falta detectar el tema en JS.
 */

export const chartGrid = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
} as const;

// `axisLine`/`tickLine` van a `--muted-foreground` y NO a `--border`: el borde
// da 1.26:1 sobre la card en claro, peor que el `#666` (5.74:1) que traía
// Recharts por defecto. La grilla sí usa `--border`, donde ser sutil es lo
// buscado. Recharts mergea estos objetos por encima del `stroke` del eje.
export const chartAxis = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  tickLine: { stroke: "hsl(var(--muted-foreground))" },
  axisLine: { stroke: "hsl(var(--muted-foreground))" },
} as const;

// `itemStyle.color` pisa el color de serie (Recharts mergea `itemStyle` DESPUÉS
// de `color: entry.color`). Es intencional: hoy todos los gráficos son de una
// sola serie, así que ese color no distingue nada y sí perjudica la lectura
// (`--chart-1` sobre `--popover` da 3.18:1 en claro). **Al agregar una segunda
// serie a cualquier gráfico hay que quitar `itemStyle`**, o todas las filas del
// tooltip van a salir del mismo color.
export const chartTooltip = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    color: "hsl(var(--popover-foreground))",
    fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 500 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
} as const;

/** Cursor de hover para gráficos de barras (banda rellena). */
export const chartCursorBar = {
  fill: "hsl(var(--muted-foreground))",
  opacity: 0.22,
} as const;

/** Cursor de hover para gráficos de líneas (línea vertical). */
export const chartCursorLine = {
  stroke: "hsl(var(--muted-foreground))",
  strokeWidth: 1,
} as const;

/**
 * Halo del punto activo en `LineChart`. Recharts lo hardcodea a `stroke: '#fff'`
 * (`ActivePoints.js`), el único resto de la librería que escapa a los tokens.
 */
export const chartActiveDot = {
  stroke: "hsl(var(--card))",
  strokeWidth: 2,
} as const;

export const CHART_COLORS = {
  1: "hsl(var(--chart-1))",
  2: "hsl(var(--chart-2))",
  3: "hsl(var(--chart-3))",
  4: "hsl(var(--chart-4))",
  5: "hsl(var(--chart-5))",
} as const;
