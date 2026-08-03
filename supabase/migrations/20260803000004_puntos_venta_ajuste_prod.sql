-- ============================================================
-- ATGQ ERP — Punto de Venta: ajuste sobre los datos reales
-- Task: P10.1
--
-- La migración …000001 sembró los puntos de venta a partir de
-- los 3 depósitos que figuraban en docs/backup_schema.sql. La
-- base real importada del legacy tiene un cuarto sector
-- ('Arma Corta') y no tiene ninguna caja llamada
-- 'Caja Principal', así que ningún PdV quedó vinculado.
--
-- Idempotente: los UPDATE son no-ops si ya está aplicado o si
-- la base no tiene esos nombres (p. ej. una base de demo).
-- ============================================================

-- 'Arma Corta' es un sector que vende al público, no un almacén
UPDATE depositos
   SET tipo = 'punto_venta'
 WHERE nombre = 'Arma Corta'
   AND tipo <> 'punto_venta';

-- Vincular cada punto de venta con la caja de tesorería homónima.
-- Sin caja, registrar_venta omite el movimiento de fondos en
-- silencio, así que este paso es lo que habilita la integración
-- ventas -> tesorería.
UPDATE depositos d
   SET caja_id = c.id
  FROM cajas c
 WHERE d.tipo = 'punto_venta'
   AND d.caja_id IS NULL
   AND c.activa
   AND lower(btrim(c.nombre)) = lower(btrim(d.nombre));
