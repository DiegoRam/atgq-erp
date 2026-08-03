-- ============================================================
-- ATGQ ERP — RPCs atómicas de stock y ventas
-- Task: P10.1
--
-- Reemplazan secuencias de escrituras no transaccionales que
-- podían dejar stock y caja inconsistentes:
--   transferir_stock  — mueve existencias entre ubicaciones
--   registrar_venta   — venta + ventas_items + stock + caja
--   anular_venta      — anulación + restitución de stock + caja
-- ============================================================


-- ============================================================
-- transferir_stock — SECURITY INVOKER
--
-- Quien transfiere ya tiene stock:escribir, así que dejar RLS
-- activa no cuesta nada y evita cualquier escalación.
--
-- Encoding igual al de realizarTransferencia (tesorería):
--   pata origen  -> tipo 'egreso' con deposito_destino_id
--   pata destino -> tipo 'transferencia' con referencia_id
-- Esto mantiene correcta la grilla de /stock/movimientos, que
-- ya pinta 'egreso' en rojo con -N y el resto en verde con +N.
--
-- No bloquea por stock insuficiente: permite negativo y devuelve
-- el saldo resultante para que la UI avise (mismo criterio que
-- registrarMovimientoStock).
-- ============================================================
CREATE OR REPLACE FUNCTION transferir_stock(
  p_item_id             UUID,
  p_deposito_origen_id  UUID,
  p_deposito_destino_id UUID,
  p_cantidad            INTEGER,
  p_motivo              TEXT DEFAULT NULL
)
RETURNS TABLE (
  movimiento_origen_id  UUID,
  movimiento_destino_id UUID,
  stock_origen          INTEGER,
  stock_destino         INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_origen      RECORD;
  v_destino     RECORD;
  v_mov_origen  UUID;
  v_mov_destino UUID;
  v_stock_o     INTEGER;
  v_stock_d     INTEGER;
  v_motivo      TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;
  IF p_deposito_origen_id = p_deposito_destino_id THEN
    RAISE EXCEPTION 'El origen y el destino deben ser diferentes';
  END IF;

  SELECT id, nombre, activo INTO v_origen
    FROM depositos WHERE id = p_deposito_origen_id;
  IF NOT FOUND OR NOT v_origen.activo THEN
    RAISE EXCEPTION 'La ubicación de origen no existe o está inactiva';
  END IF;

  SELECT id, nombre, activo INTO v_destino
    FROM depositos WHERE id = p_deposito_destino_id;
  IF NOT FOUND OR NOT v_destino.activo THEN
    RAISE EXCEPTION 'La ubicación de destino no existe o está inactiva';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM stock_items WHERE id = p_item_id AND activo) THEN
    RAISE EXCEPTION 'El ítem no existe o está inactivo';
  END IF;

  v_motivo := NULLIF(btrim(COALESCE(p_motivo, '')), '');

  -- Inventario: ambas patas en UNA sentencia.
  -- ON CONFLICT DO UPDATE toma el row lock y resuelve el caso
  -- "la fila todavía no existe"; el ORDER BY da un orden de
  -- bloqueo determinístico que evita deadlocks entre dos
  -- transferencias cruzadas (A->B y B->A simultáneas).
  WITH ups AS (
    INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
    SELECT p_item_id, d.deposito_id, d.delta
      FROM (VALUES (p_deposito_origen_id,  -p_cantidad),
                   (p_deposito_destino_id,  p_cantidad)) AS d(deposito_id, delta)
     ORDER BY d.deposito_id
    ON CONFLICT (item_id, deposito_id) DO UPDATE
       SET cantidad   = stock_inventario.cantidad + EXCLUDED.cantidad,
           updated_at = now()
    RETURNING deposito_id, cantidad
  )
  SELECT max(cantidad) FILTER (WHERE deposito_id = p_deposito_origen_id),
         max(cantidad) FILTER (WHERE deposito_id = p_deposito_destino_id)
    INTO v_stock_o, v_stock_d
    FROM ups;

  -- Pata de salida (origen)
  INSERT INTO movimientos_stock
    (item_id, deposito_id, deposito_destino_id, tipo, cantidad, motivo, usuario_id)
  VALUES
    (p_item_id, p_deposito_origen_id, p_deposito_destino_id, 'egreso', p_cantidad,
     COALESCE(v_motivo, 'Transferencia a ' || v_destino.nombre), v_user_id)
  RETURNING id INTO v_mov_origen;

  -- Pata de entrada (destino)
  INSERT INTO movimientos_stock
    (item_id, deposito_id, tipo, cantidad, motivo, referencia_id, usuario_id)
  VALUES
    (p_item_id, p_deposito_destino_id, 'transferencia', p_cantidad,
     COALESCE(v_motivo, 'Transferencia desde ' || v_origen.nombre), v_mov_origen, v_user_id)
  RETURNING id INTO v_mov_destino;

  -- Referencia cruzada
  UPDATE movimientos_stock SET referencia_id = v_mov_destino WHERE id = v_mov_origen;

  RETURN QUERY SELECT v_mov_origen, v_mov_destino, v_stock_o, v_stock_d;
END;
$$;

COMMENT ON FUNCTION transferir_stock(UUID, UUID, UUID, INTEGER, TEXT) IS
  'Transfiere existencias entre dos ubicaciones (depósito o punto de venta) de forma atómica';


-- ============================================================
-- registrar_venta — SECURITY DEFINER
--
-- Un Recepcionista tiene ventas:escribir pero NO stock:escribir
-- ni tesoreria:escribir. En vez de darle escritura amplia sobre
-- esos módulos, la función corre como owner y re-chequea
-- ventas:escribir: puede *causar* el movimiento de stock/caja
-- como consecuencia de una venta autorizada, pero no postear
-- movimientos arbitrarios.
--
-- Los precios salen de items_ventas, no del payload del browser.
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_venta(
  p_punto_venta_id UUID,
  p_cliente_id     UUID,
  p_socio_id       UUID,
  p_metodo_pago_id UUID,
  p_items          JSONB   -- [{"item_id": "uuid", "cantidad": 2}, ...]
)
RETURNS TABLE (
  venta_id            UUID,
  venta_total         NUMERIC,
  movimiento_fondo_id UUID,
  items_negativos     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_pdv       RECORD;
  v_venta_id  UUID;
  v_total     NUMERIC(12,2);
  v_items     JSONB;
  v_cat       UUID;
  v_mov_fondo UUID;
  v_negativos JSONB;
  v_ref       TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- SECURITY DEFINER => RLS no aplica: el chequeo es obligatorio acá
  IF NOT get_user_modulo_permission('ventas', 'escribir') THEN
    RAISE EXCEPTION 'No tiene permisos para registrar ventas';
  END IF;

  IF p_cliente_id IS NULL AND p_socio_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar un cliente o un socio';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agregue al menos un ítem';
  END IF;

  SELECT id, nombre, caja_id, activo, tipo INTO v_pdv
    FROM depositos WHERE id = p_punto_venta_id;
  IF NOT FOUND OR NOT v_pdv.activo OR v_pdv.tipo <> 'punto_venta' THEN
    RAISE EXCEPTION 'Punto de venta inválido o inactivo';
  END IF;

  -- Normalizar ítems con precio autoritativo del servidor
  SELECT jsonb_agg(jsonb_build_object(
           'item_id',         iv.id,
           'stock_item_id',   iv.stock_item_id,
           'cantidad',        x.cantidad,
           'precio_unitario', iv.precio,
           'subtotal',        round(iv.precio * x.cantidad, 2)))
    INTO v_items
    FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad INTEGER)
    JOIN items_ventas iv ON iv.id = x.item_id AND iv.activo
   WHERE x.cantidad > 0;

  IF v_items IS NULL OR jsonb_array_length(v_items) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Algún ítem no existe, está inactivo o tiene cantidad inválida';
  END IF;

  SELECT COALESCE(sum((i->>'subtotal')::NUMERIC), 0)::NUMERIC(12,2)
    INTO v_total
    FROM jsonb_array_elements(v_items) AS i;

  INSERT INTO ventas (cliente_id, socio_id, punto_venta_id, fecha, total,
                      metodo_pago_id, usuario_id, anulada)
  VALUES (p_cliente_id, p_socio_id, p_punto_venta_id, now(), v_total,
          p_metodo_pago_id, v_user_id, false)
  RETURNING id INTO v_venta_id;

  v_ref := 'Venta #' || upper(left(v_venta_id::text, 8));

  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal)
  SELECT v_venta_id, i.item_id, i.cantidad, i.precio_unitario, i.subtotal
    FROM jsonb_to_recordset(v_items)
      AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
           precio_unitario NUMERIC, subtotal NUMERIC);

  -- ---- Stock: egreso desde el PUNTO DE VENTA ----
  INSERT INTO movimientos_stock
    (item_id, deposito_id, tipo, cantidad, motivo, referencia_id, usuario_id)
  SELECT i.stock_item_id, p_punto_venta_id, 'egreso', i.cantidad,
         v_ref, v_venta_id, v_user_id
    FROM jsonb_to_recordset(v_items)
      AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
           precio_unitario NUMERIC, subtotal NUMERIC)
   WHERE i.stock_item_id IS NOT NULL;

  -- Agrupado por ítem: dos líneas del mismo ítem no pueden tocar
  -- la misma fila de inventario dos veces en un ON CONFLICT
  WITH ups AS (
    INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
    SELECT i.stock_item_id, p_punto_venta_id, -sum(i.cantidad)
      FROM jsonb_to_recordset(v_items)
        AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
             precio_unitario NUMERIC, subtotal NUMERIC)
     WHERE i.stock_item_id IS NOT NULL
     GROUP BY i.stock_item_id
     ORDER BY i.stock_item_id
    ON CONFLICT (item_id, deposito_id) DO UPDATE
       SET cantidad   = stock_inventario.cantidad + EXCLUDED.cantidad,
           updated_at = now()
    RETURNING item_id, cantidad
  )
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object('nombre', si.nombre, 'cantidad', u.cantidad)),
           '[]'::jsonb)
    INTO v_negativos
    FROM ups u
    JOIN stock_items si ON si.id = u.item_id
   WHERE u.cantidad < 0;

  -- ---- Tesorería: ingreso en la caja del punto de venta ----
  IF v_pdv.caja_id IS NOT NULL AND v_total > 0 THEN
    SELECT id INTO v_cat FROM categorias_movimientos
     WHERE nombre = 'Ventas' AND tipo = 'ingreso' LIMIT 1;
    IF v_cat IS NULL THEN
      RAISE EXCEPTION 'Falta la categoría de ingreso "Ventas" en tesorería';
    END IF;

    INSERT INTO movimientos_fondos
      (caja_id, categoria_id, tipo, monto, descripcion, fecha, referencia_id, usuario_id)
    VALUES (v_pdv.caja_id, v_cat, 'ingreso', v_total,
            v_ref || ' — ' || v_pdv.nombre, now(), v_venta_id, v_user_id)
    RETURNING id INTO v_mov_fondo;
  END IF;

  RETURN QUERY SELECT v_venta_id, v_total, v_mov_fondo, v_negativos;
END;
$$;

REVOKE ALL ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB) IS
  'Registra una venta en un punto de venta: cabecera, ítems, egreso de stock del PdV e ingreso en su caja';


-- ============================================================
-- anular_venta — SECURITY DEFINER
--
-- Antes la anulación sólo marcaba anulada = true y filtraba
-- inventario (nunca restituía stock). Con caja de por medio eso
-- ya no alcanza. Todo compensatorio: el ledger es append-only,
-- no se borra ni se retro-fecha nada.
--
-- Las ventas históricas (y las del import legacy) no tienen
-- movimientos vinculados, así que ahí es un no-op.
-- ============================================================
CREATE OR REPLACE FUNCTION anular_venta(
  p_venta_id UUID,
  p_motivo   TEXT DEFAULT NULL
)
RETURNS TABLE (
  items_restituidos   INTEGER,
  movimiento_fondo_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_venta   RECORD;
  v_cat     UUID;
  v_mov     UUID;
  v_n       INTEGER := 0;
  v_ref     TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT get_user_modulo_permission('ventas', 'escribir') THEN
    RAISE EXCEPTION 'No tiene permisos para anular ventas';
  END IF;

  SELECT id, anulada INTO v_venta FROM ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe';
  END IF;
  IF v_venta.anulada THEN
    RAISE EXCEPTION 'La venta ya está anulada';
  END IF;

  v_ref := 'Anulación venta #' || upper(left(p_venta_id::text, 8))
           || COALESCE(' — ' || NULLIF(btrim(COALESCE(p_motivo, '')), ''), '');

  UPDATE ventas SET anulada = true WHERE id = p_venta_id;

  -- 1) Restituir stock con contramovimientos de ingreso, en la
  --    MISMA ubicación que registró el egreso original (correcto
  --    aunque el punto de venta se haya renombrado desde entonces)
  INSERT INTO movimientos_stock
    (item_id, deposito_id, tipo, cantidad, motivo, referencia_id, usuario_id)
  SELECT ms.item_id, ms.deposito_id, 'ingreso', ms.cantidad,
         v_ref, p_venta_id, v_user_id
    FROM movimientos_stock ms
   WHERE ms.referencia_id = p_venta_id AND ms.tipo = 'egreso';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
  SELECT ms.item_id, ms.deposito_id, sum(ms.cantidad)
    FROM movimientos_stock ms
   WHERE ms.referencia_id = p_venta_id AND ms.tipo = 'egreso'
   GROUP BY ms.item_id, ms.deposito_id
   ORDER BY ms.item_id, ms.deposito_id
  ON CONFLICT (item_id, deposito_id) DO UPDATE
     SET cantidad   = stock_inventario.cantidad + EXCLUDED.cantidad,
         updated_at = now();

  -- 2) Revertir el ingreso en caja con un egreso compensatorio
  --    en la misma caja, fechado now() (no retroactivo: no altera
  --    reportes ya emitidos)
  SELECT id INTO v_cat FROM categorias_movimientos
   WHERE nombre = 'Anulación de Ventas' AND tipo = 'egreso' LIMIT 1;

  IF v_cat IS NOT NULL THEN
    INSERT INTO movimientos_fondos
      (caja_id, categoria_id, tipo, monto, descripcion, fecha, referencia_id, usuario_id)
    SELECT mf.caja_id, v_cat, 'egreso', mf.monto, v_ref, now(), p_venta_id, v_user_id
      FROM movimientos_fondos mf
     WHERE mf.referencia_id = p_venta_id AND mf.tipo = 'ingreso'
     LIMIT 1
    RETURNING id INTO v_mov;
  END IF;

  RETURN QUERY SELECT v_n, v_mov;
END;
$$;

REVOKE ALL ON FUNCTION anular_venta(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anular_venta(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION anular_venta(UUID, TEXT) IS
  'Anula una venta, restituye el stock en su punto de venta y compensa el ingreso en caja';
