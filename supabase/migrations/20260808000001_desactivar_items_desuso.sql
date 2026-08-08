-- ============================================================
-- ATGQ ERP — Ítems dados de baja por nombre en el legacy
--
-- La tabla legacy `ItemsVentas` no tenía columna `activo`, así
-- que la baja de un ítem se hacía renombrándolo con el prefijo
-- "(DESUSO)" (el log de auditoría de Scriptcase registra esos
-- renames uno por uno). `migration/migrate.py` copió el nombre
-- tal cual e importó las 210 filas con activo = true, con lo
-- cual esos ítems siguen apareciendo en el combobox del POS y
-- en las altas de movimientos de stock.
--
-- El nombre no se toca: las ventas históricas lo referencian y
-- el reporte por-ítem incluye inactivos a propósito.
--
-- Marcadores y filas esperadas sobre la base importada del
-- legacy (docs/backup.sql, 210 filas en ItemsVentas):
--
--   '%desuso%'   → 24 filas en items_ventas, 4 de ellas también
--                  en stock_items (las que tenían DescuentaStock=1).
--   '%no usar%'  → 1 fila, 'No Usar Mun. SP .9mm encamisada 147
--                  grs.' (idItem 714, DescuentaStock=0, así que
--                  no tiene contraparte en stock_items).
--
--   Total: 25 filas en items_ventas y 4 en stock_items.
--
-- Se usa ILIKE '%...%' y no LIKE '(DESUSO)%': hay nombres con
-- espacio inicial (' (DESUSO) Fichas Helices - NO Socios -
-- ESCOPETA') y sin espacio tras el paréntesis ('(DESUSO)Id.
-- Portacion y/o Anexo IV ...'), que un patrón anclado al
-- principio dejaría afuera.
--
-- Los marcadores deben mantenerse en sync con `mig_items` en
-- migration/migrate.py, que aplica el mismo criterio al importar
-- para que una re-corrida desde el dump no los reintroduzca
-- (los INSERT usan ON CONFLICT DO NOTHING, así que el importador
-- por sí solo nunca corregiría las filas ya cargadas).
--
-- Idempotente: el `AND activo` hace que la segunda corrida sea
-- un no-op, y evita pisar bajas hechas a mano desde el ABM. En
-- una base sin datos legacy (p. ej. una de demo) no afecta
-- ninguna fila.
--
-- Para revertir: la importación dejó estas filas en activo =
-- true sin excepción, así que el inverso es exacto.
--
--   UPDATE items_ventas SET activo = true
--    WHERE nombre ILIKE '%desuso%' OR nombre ILIKE '%no usar%';
--   UPDATE stock_items  SET activo = true
--    WHERE nombre ILIKE '%desuso%' OR nombre ILIKE '%no usar%';
--
-- (Sólo reactivaría de más si alguien ya había dado de baja a
-- mano uno de estos ítems desde el ABM; se corrige ítem por
-- ítem desde /ventas/items o /stock/items.)
-- ============================================================

UPDATE items_ventas
   SET activo = false
 WHERE activo
   AND (nombre ILIKE '%desuso%' OR nombre ILIKE '%no usar%');

UPDATE stock_items
   SET activo = false
 WHERE activo
   AND (nombre ILIKE '%desuso%' OR nombre ILIKE '%no usar%');
