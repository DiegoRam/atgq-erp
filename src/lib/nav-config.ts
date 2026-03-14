export type NavItem = {
  label: string;
  href: string;
};

export type NavSeparator = { separator: true };

export type NavModule = {
  label: string;
  items: (NavItem | NavSeparator)[];
};

const sep: NavSeparator = { separator: true };

export const NAV_MODULES: NavModule[] = [
  {
    label: "SOCIOS",
    items: [
      { label: "Administración de Socios", href: "/socios" },
      { label: "Ver Grupos Familiares", href: "/socios/grupos-familiares" },
      { label: "Socios Morosos", href: "/socios/morosos" },
      { label: "Cuotas", href: "/socios/cuotas" },
      { label: "Padrón", href: "/socios/padron" },
      sep,
      { label: "Socios por Categorías", href: "/socios/reportes/categorias" },
      { label: "Socios por Edades", href: "/socios/reportes/edades" },
      {
        label: "Cuotas cobradas mensualmente",
        href: "/socios/reportes/cuotas-mensuales",
      },
      { label: "Socios por Localidad", href: "/socios/reportes/localidad" },
      {
        label: "Mapas Distribución de Socios",
        href: "/socios/reportes/mapas",
      },
      sep,
      { label: "Categorías Sociales", href: "/socios/config/categorias" },
      { label: "Tipo de Cuotas", href: "/socios/config/tipo-cuotas" },
      { label: "Cobranzas", href: "/socios/config/cobranzas" },
    ],
  },
  {
    label: "ACTIVIDADES",
    items: [
      { label: "Administración de Actividades", href: "/actividades" },
      {
        label: "Generar Cuota de Actividades",
        href: "/actividades/generar-cuota",
      },
      { label: "Actividades Extras", href: "/actividades/extras" },
    ],
  },
  {
    label: "TURNOS",
    items: [{ label: "Administrar Turnos", href: "/turnos" }],
  },
  {
    label: "VENTAS",
    items: [
      { label: "Nueva Venta", href: "/ventas/nueva" },
      { label: "Ventas Realizadas", href: "/ventas" },
      { label: "Clientes", href: "/ventas/clientes" },
      { label: "Items de Ventas", href: "/ventas/items" },
      sep,
      {
        label: "Ventas Sumarizadas Mensual",
        href: "/ventas/reportes/mensual",
      },
      { label: "Ventas Sumarizadas Diaria", href: "/ventas/reportes/diaria" },
      { label: "Venta de Item/periodo", href: "/ventas/reportes/por-item" },
      { label: "Gráfico de Ventas", href: "/ventas/reportes/grafico-ventas" },
      { label: "Gráfico de Items", href: "/ventas/reportes/grafico-items" },
    ],
  },
  {
    label: "STOCK",
    items: [
      { label: "Inventario", href: "/stock" },
      { label: "Ingresos / Egresos", href: "/stock/movimientos/nuevo" },
      { label: "Movimientos de Stock", href: "/stock/movimientos" },
      sep,
      { label: "Depósitos", href: "/stock/depositos" },
    ],
  },
  {
    label: "TESORERÍA",
    items: [
      { label: "Cajas", href: "/tesoreria/cajas" },
      { label: "Ingresar Movimiento", href: "/tesoreria/movimientos/nuevo" },
      { label: "Movimientos de Fondos", href: "/tesoreria/movimientos" },
      {
        label: "Transferencias entre cajas",
        href: "/tesoreria/transferencias",
      },
      sep,
      {
        label: "Sumarización de Conceptos",
        href: "/tesoreria/reportes/sumarizacion",
      },
      {
        label: "Concepto entre fechas",
        href: "/tesoreria/reportes/concepto-fechas",
      },
      {
        label: "Gráfico de Movimientos",
        href: "/tesoreria/reportes/grafico-movimientos",
      },
      {
        label: "Gráfico de Mov. de Salidas",
        href: "/tesoreria/reportes/grafico-salidas",
      },
      {
        label: "Categorías movimientos",
        href: "/tesoreria/config/categorias",
      },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Usuarios", href: "/security/usuarios" },
      { label: "Roles y Permisos", href: "/security/roles" },
    ],
  },
];
