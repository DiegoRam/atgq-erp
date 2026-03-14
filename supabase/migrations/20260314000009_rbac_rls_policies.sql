-- ============================================================
-- ATGQ ERP — RBAC RLS Policies
-- Task: P9.3
-- Replaces permissive "authenticated_all" policies with
-- role-based policies using permisos_modulo table.
-- ============================================================

-- Step 1: Helper function (SECURITY DEFINER to bypass RLS on security tables)
CREATE OR REPLACE FUNCTION get_user_modulo_permission(p_modulo text, p_permiso text)
RETURNS boolean AS $$
  SELECT COALESCE((
    SELECT CASE p_permiso
      WHEN 'leer' THEN pm.puede_leer
      WHEN 'escribir' THEN pm.puede_escribir
      WHEN 'eliminar' THEN pm.puede_eliminar
    END
    FROM usuarios_roles ur
    JOIN permisos_modulo pm ON pm.rol_id = ur.rol_id
    WHERE ur.user_id = auth.uid() AND pm.modulo = p_modulo
    LIMIT 1
  ), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Performance index
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_user_id ON usuarios_roles(user_id);

-- Step 3: Drop all existing permissive policies

-- SOCIOS module
DROP POLICY IF EXISTS "authenticated_all" ON socios;
DROP POLICY IF EXISTS "authenticated_all" ON categorias_sociales;
DROP POLICY IF EXISTS "authenticated_all" ON metodos_cobranza;
DROP POLICY IF EXISTS "authenticated_all" ON grupos_familiares;
DROP POLICY IF EXISTS "authenticated_all" ON cuotas;
DROP POLICY IF EXISTS "authenticated_all" ON tipos_cuotas;

-- ACTIVIDADES module
DROP POLICY IF EXISTS "authenticated_all" ON actividades;
DROP POLICY IF EXISTS "authenticated_all" ON socios_actividades;
DROP POLICY IF EXISTS "authenticated_all" ON actividades_extras;

-- TURNOS module
DROP POLICY IF EXISTS "authenticated_all" ON instalaciones;
DROP POLICY IF EXISTS "authenticated_all" ON turnos;

-- VENTAS module
DROP POLICY IF EXISTS "authenticated_all" ON clientes;
DROP POLICY IF EXISTS "authenticated_all" ON stock_items;
DROP POLICY IF EXISTS "authenticated_all" ON items_ventas;
DROP POLICY IF EXISTS "authenticated_all" ON ventas;
DROP POLICY IF EXISTS "authenticated_all" ON ventas_items;

-- STOCK module
DROP POLICY IF EXISTS "authenticated_all" ON depositos;
DROP POLICY IF EXISTS "authenticated_all" ON stock_inventario;
DROP POLICY IF EXISTS "authenticated_all" ON movimientos_stock;

-- TESORERÍA module
DROP POLICY IF EXISTS "authenticated_all" ON cajas;
DROP POLICY IF EXISTS "authenticated_all" ON categorias_movimientos;
DROP POLICY IF EXISTS "authenticated_all" ON movimientos_fondos;

-- SECURITY module
DROP POLICY IF EXISTS "authenticated_all" ON roles;
DROP POLICY IF EXISTS "authenticated_all" ON permisos_modulo;
DROP POLICY IF EXISTS "authenticated_all" ON usuarios_roles;

-- Step 4: Create RBAC policies per table

-- ========== SOCIOS module ==========

-- socios
CREATE POLICY "select_socios" ON socios FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_socios" ON socios FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_socios" ON socios FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_socios" ON socios FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- categorias_sociales
CREATE POLICY "select_categorias_sociales" ON categorias_sociales FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_categorias_sociales" ON categorias_sociales FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_categorias_sociales" ON categorias_sociales FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_categorias_sociales" ON categorias_sociales FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- metodos_cobranza
CREATE POLICY "select_metodos_cobranza" ON metodos_cobranza FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_metodos_cobranza" ON metodos_cobranza FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_metodos_cobranza" ON metodos_cobranza FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_metodos_cobranza" ON metodos_cobranza FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- grupos_familiares
CREATE POLICY "select_grupos_familiares" ON grupos_familiares FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_grupos_familiares" ON grupos_familiares FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_grupos_familiares" ON grupos_familiares FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_grupos_familiares" ON grupos_familiares FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- cuotas
CREATE POLICY "select_cuotas" ON cuotas FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_cuotas" ON cuotas FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_cuotas" ON cuotas FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_cuotas" ON cuotas FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- tipos_cuotas
CREATE POLICY "select_tipos_cuotas" ON tipos_cuotas FOR SELECT TO authenticated
  USING (get_user_modulo_permission('socios', 'leer'));
CREATE POLICY "insert_tipos_cuotas" ON tipos_cuotas FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "update_tipos_cuotas" ON tipos_cuotas FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('socios', 'escribir'))
  WITH CHECK (get_user_modulo_permission('socios', 'escribir'));
CREATE POLICY "delete_tipos_cuotas" ON tipos_cuotas FOR DELETE TO authenticated
  USING (get_user_modulo_permission('socios', 'eliminar'));

-- ========== ACTIVIDADES module ==========

-- actividades
CREATE POLICY "select_actividades" ON actividades FOR SELECT TO authenticated
  USING (get_user_modulo_permission('actividades', 'leer'));
CREATE POLICY "insert_actividades" ON actividades FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "update_actividades" ON actividades FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('actividades', 'escribir'))
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "delete_actividades" ON actividades FOR DELETE TO authenticated
  USING (get_user_modulo_permission('actividades', 'eliminar'));

-- socios_actividades
CREATE POLICY "select_socios_actividades" ON socios_actividades FOR SELECT TO authenticated
  USING (get_user_modulo_permission('actividades', 'leer'));
CREATE POLICY "insert_socios_actividades" ON socios_actividades FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "update_socios_actividades" ON socios_actividades FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('actividades', 'escribir'))
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "delete_socios_actividades" ON socios_actividades FOR DELETE TO authenticated
  USING (get_user_modulo_permission('actividades', 'eliminar'));

-- actividades_extras
CREATE POLICY "select_actividades_extras" ON actividades_extras FOR SELECT TO authenticated
  USING (get_user_modulo_permission('actividades', 'leer'));
CREATE POLICY "insert_actividades_extras" ON actividades_extras FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "update_actividades_extras" ON actividades_extras FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('actividades', 'escribir'))
  WITH CHECK (get_user_modulo_permission('actividades', 'escribir'));
CREATE POLICY "delete_actividades_extras" ON actividades_extras FOR DELETE TO authenticated
  USING (get_user_modulo_permission('actividades', 'eliminar'));

-- ========== TURNOS module ==========

-- instalaciones
CREATE POLICY "select_instalaciones" ON instalaciones FOR SELECT TO authenticated
  USING (get_user_modulo_permission('turnos', 'leer'));
CREATE POLICY "insert_instalaciones" ON instalaciones FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('turnos', 'escribir'));
CREATE POLICY "update_instalaciones" ON instalaciones FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('turnos', 'escribir'))
  WITH CHECK (get_user_modulo_permission('turnos', 'escribir'));
CREATE POLICY "delete_instalaciones" ON instalaciones FOR DELETE TO authenticated
  USING (get_user_modulo_permission('turnos', 'eliminar'));

-- turnos
CREATE POLICY "select_turnos" ON turnos FOR SELECT TO authenticated
  USING (get_user_modulo_permission('turnos', 'leer'));
CREATE POLICY "insert_turnos" ON turnos FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('turnos', 'escribir'));
CREATE POLICY "update_turnos" ON turnos FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('turnos', 'escribir'))
  WITH CHECK (get_user_modulo_permission('turnos', 'escribir'));
CREATE POLICY "delete_turnos" ON turnos FOR DELETE TO authenticated
  USING (get_user_modulo_permission('turnos', 'eliminar'));

-- ========== VENTAS module ==========

-- clientes
CREATE POLICY "select_clientes" ON clientes FOR SELECT TO authenticated
  USING (get_user_modulo_permission('ventas', 'leer'));
CREATE POLICY "insert_clientes" ON clientes FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "update_clientes" ON clientes FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('ventas', 'escribir'))
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "delete_clientes" ON clientes FOR DELETE TO authenticated
  USING (get_user_modulo_permission('ventas', 'eliminar'));

-- items_ventas
CREATE POLICY "select_items_ventas" ON items_ventas FOR SELECT TO authenticated
  USING (get_user_modulo_permission('ventas', 'leer'));
CREATE POLICY "insert_items_ventas" ON items_ventas FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "update_items_ventas" ON items_ventas FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('ventas', 'escribir'))
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "delete_items_ventas" ON items_ventas FOR DELETE TO authenticated
  USING (get_user_modulo_permission('ventas', 'eliminar'));

-- ventas
CREATE POLICY "select_ventas" ON ventas FOR SELECT TO authenticated
  USING (get_user_modulo_permission('ventas', 'leer'));
CREATE POLICY "insert_ventas" ON ventas FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "update_ventas" ON ventas FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('ventas', 'escribir'))
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "delete_ventas" ON ventas FOR DELETE TO authenticated
  USING (get_user_modulo_permission('ventas', 'eliminar'));

-- ventas_items
CREATE POLICY "select_ventas_items" ON ventas_items FOR SELECT TO authenticated
  USING (get_user_modulo_permission('ventas', 'leer'));
CREATE POLICY "insert_ventas_items" ON ventas_items FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "update_ventas_items" ON ventas_items FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('ventas', 'escribir'))
  WITH CHECK (get_user_modulo_permission('ventas', 'escribir'));
CREATE POLICY "delete_ventas_items" ON ventas_items FOR DELETE TO authenticated
  USING (get_user_modulo_permission('ventas', 'eliminar'));

-- ========== STOCK module ==========

-- stock_items (shared between ventas and stock, use stock module)
CREATE POLICY "select_stock_items" ON stock_items FOR SELECT TO authenticated
  USING (get_user_modulo_permission('stock', 'leer') OR get_user_modulo_permission('ventas', 'leer'));
CREATE POLICY "insert_stock_items" ON stock_items FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "update_stock_items" ON stock_items FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('stock', 'escribir'))
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "delete_stock_items" ON stock_items FOR DELETE TO authenticated
  USING (get_user_modulo_permission('stock', 'eliminar'));

-- depositos
CREATE POLICY "select_depositos" ON depositos FOR SELECT TO authenticated
  USING (get_user_modulo_permission('stock', 'leer'));
CREATE POLICY "insert_depositos" ON depositos FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "update_depositos" ON depositos FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('stock', 'escribir'))
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "delete_depositos" ON depositos FOR DELETE TO authenticated
  USING (get_user_modulo_permission('stock', 'eliminar'));

-- stock_inventario
CREATE POLICY "select_stock_inventario" ON stock_inventario FOR SELECT TO authenticated
  USING (get_user_modulo_permission('stock', 'leer'));
CREATE POLICY "insert_stock_inventario" ON stock_inventario FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "update_stock_inventario" ON stock_inventario FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('stock', 'escribir'))
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "delete_stock_inventario" ON stock_inventario FOR DELETE TO authenticated
  USING (get_user_modulo_permission('stock', 'eliminar'));

-- movimientos_stock
CREATE POLICY "select_movimientos_stock" ON movimientos_stock FOR SELECT TO authenticated
  USING (get_user_modulo_permission('stock', 'leer'));
CREATE POLICY "insert_movimientos_stock" ON movimientos_stock FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "update_movimientos_stock" ON movimientos_stock FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('stock', 'escribir'))
  WITH CHECK (get_user_modulo_permission('stock', 'escribir'));
CREATE POLICY "delete_movimientos_stock" ON movimientos_stock FOR DELETE TO authenticated
  USING (get_user_modulo_permission('stock', 'eliminar'));

-- ========== TESORERÍA module ==========

-- cajas
CREATE POLICY "select_cajas" ON cajas FOR SELECT TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'leer'));
CREATE POLICY "insert_cajas" ON cajas FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "update_cajas" ON cajas FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'escribir'))
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "delete_cajas" ON cajas FOR DELETE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'eliminar'));

-- categorias_movimientos
CREATE POLICY "select_categorias_movimientos" ON categorias_movimientos FOR SELECT TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'leer'));
CREATE POLICY "insert_categorias_movimientos" ON categorias_movimientos FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "update_categorias_movimientos" ON categorias_movimientos FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'escribir'))
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "delete_categorias_movimientos" ON categorias_movimientos FOR DELETE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'eliminar'));

-- movimientos_fondos
CREATE POLICY "select_movimientos_fondos" ON movimientos_fondos FOR SELECT TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'leer'));
CREATE POLICY "insert_movimientos_fondos" ON movimientos_fondos FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "update_movimientos_fondos" ON movimientos_fondos FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'escribir'))
  WITH CHECK (get_user_modulo_permission('tesoreria', 'escribir'));
CREATE POLICY "delete_movimientos_fondos" ON movimientos_fondos FOR DELETE TO authenticated
  USING (get_user_modulo_permission('tesoreria', 'eliminar'));

-- ========== SECURITY module ==========

-- roles
CREATE POLICY "select_roles" ON roles FOR SELECT TO authenticated
  USING (get_user_modulo_permission('seguridad', 'leer'));
CREATE POLICY "insert_roles" ON roles FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "update_roles" ON roles FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'escribir'))
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "delete_roles" ON roles FOR DELETE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'eliminar'));

-- permisos_modulo
CREATE POLICY "select_permisos_modulo" ON permisos_modulo FOR SELECT TO authenticated
  USING (get_user_modulo_permission('seguridad', 'leer'));
CREATE POLICY "insert_permisos_modulo" ON permisos_modulo FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "update_permisos_modulo" ON permisos_modulo FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'escribir'))
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "delete_permisos_modulo" ON permisos_modulo FOR DELETE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'eliminar'));

-- usuarios_roles
CREATE POLICY "select_usuarios_roles" ON usuarios_roles FOR SELECT TO authenticated
  USING (get_user_modulo_permission('seguridad', 'leer'));
CREATE POLICY "insert_usuarios_roles" ON usuarios_roles FOR INSERT TO authenticated
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "update_usuarios_roles" ON usuarios_roles FOR UPDATE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'escribir'))
  WITH CHECK (get_user_modulo_permission('seguridad', 'escribir'));
CREATE POLICY "delete_usuarios_roles" ON usuarios_roles FOR DELETE TO authenticated
  USING (get_user_modulo_permission('seguridad', 'eliminar'));
