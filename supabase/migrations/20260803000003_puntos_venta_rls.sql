-- ============================================================
-- ATGQ ERP — Punto de Venta: ajustes de RLS
-- Task: P10.1
--
-- Los puntos de venta son filas de `depositos`, así que
-- stock_inventario y movimientos_stock no requieren cambios.
-- Sólo hay dos lecturas cruzadas nuevas entre módulos.
-- ============================================================

-- El POS (módulo VENTAS) necesita listar los puntos de venta,
-- pero no debe ver los depósitos internos.
-- Precedente de política multi-módulo: select_stock_items.
DROP POLICY IF EXISTS "select_depositos" ON depositos;
CREATE POLICY "select_depositos" ON depositos FOR SELECT TO authenticated
  USING (
    get_user_modulo_permission('stock', 'leer')
    OR (tipo = 'punto_venta' AND get_user_modulo_permission('ventas', 'leer'))
  );

-- El ABM de Puntos de Venta vive en el módulo STOCK y necesita
-- listar las cajas para el selector `caja_id`.
DROP POLICY IF EXISTS "select_cajas" ON cajas;
CREATE POLICY "select_cajas" ON cajas FOR SELECT TO authenticated
  USING (
    get_user_modulo_permission('tesoreria', 'leer')
    OR get_user_modulo_permission('stock', 'escribir')
  );
