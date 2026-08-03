-- Limpia los datos DEMO (seed) antes de la migración real del legacy.
-- PRESERVA: auth.users, roles, permisos_modulo, usuarios_roles (RBAC real).
-- Vacía todas las tablas de dominio que la migración vuelve a poblar.
BEGIN;
TRUNCATE
  cuotas, socios_actividades, turnos, ventas_items, movimientos_stock,
  movimientos_fondos, stock_inventario, grupos_familiares, ventas,
  socios, clientes, items_ventas, stock_items, depositos, instalaciones,
  actividades, actividades_extras, cajas, categorias_movimientos,
  categorias_sociales, metodos_cobranza, tipos_cuotas
RESTART IDENTITY CASCADE;
COMMIT;
