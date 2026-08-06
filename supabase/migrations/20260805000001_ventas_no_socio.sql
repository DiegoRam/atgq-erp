-- ============================================================
-- ATGQ ERP — Ventas a NO SOCIO
--
-- En el mostrador el tirador ocasional no tiene ficha cargada:
-- se lo atiende en el momento. Y por ser polígono hay que dejar
-- constancia de su credencial de legítimo usuario (ANMaC).
--
-- Los datos viven en la propia venta (no se crean fichas en
-- `clientes`): son un ocasional, no un cliente recurrente.
-- `cliente_id` se mantiene para el histórico ya cargado.
--
-- Re-runnable: usa IF NOT EXISTS / guards de pg_constraint.
-- ============================================================

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS no_socio_nombre                 TEXT,
  ADD COLUMN IF NOT EXISTS no_socio_dni                    TEXT,
  ADD COLUMN IF NOT EXISTS no_socio_credencial_vencimiento DATE;

COMMENT ON COLUMN ventas.no_socio_nombre IS
  'Nombre y apellido del comprador no socio, tipeado en el mostrador (NULL si la venta es a un socio o a un cliente del histórico)';
COMMENT ON COLUMN ventas.no_socio_dni IS
  'DNI declarado por el comprador no socio';
COMMENT ON COLUMN ventas.no_socio_credencial_vencimiento IS
  'Vencimiento de la credencial de legítimo usuario (ANMaC) declarada en el mostrador';

DO $$
BEGIN
  -- Los tres van juntos o ninguno. Las filas históricas tienen los
  -- tres en NULL (0 no-nulos), así que la validación no las toca —
  -- tampoco cuando `anular_venta` las UPDATEa.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventas_no_socio_completo'
  ) THEN
    ALTER TABLE ventas ADD CONSTRAINT ventas_no_socio_completo
      CHECK (num_nonnulls(no_socio_nombre, no_socio_dni, no_socio_credencial_vencimiento) IN (0, 3));
  END IF;
END $$;


-- ============================================================
-- ventas_comprador_guard — BEFORE INSERT OR UPDATE
--
-- "Toda venta identifica a alguien" vale para las filas nuevas y
-- para las ediciones, no para el pasado: el import legacy y los
-- seeds viejos dejaron ventas sin socio ni cliente. Un
-- CHECK ... NOT VALID **no** sirve acá: saltea la validación de
-- las filas existentes sólo al crearse, pero Postgres lo sigue
-- evaluando en cada UPDATE posterior, así que `anular_venta`
-- (UPDATE ventas SET anulada = true) se rompería sobre toda venta
-- histórica sin comprador. El trigger, en cambio, puede mirar OLD
-- y dejar pasar lo que ya venía mal sin habilitar nuevos casos.
--
-- El vencimiento se chequea sólo en el INSERT: si también corriera
-- en UPDATE, anular una venta de hace meses fallaría porque la
-- credencial de ese comprador ya venció.
--
-- Duplica lo que ya valida `registrar_venta` a propósito: cierra
-- el camino de un POST/PATCH directo a /rest/v1/ventas por
-- PostgREST, que RLS permite a quien tiene ventas:escribir.
-- ============================================================
CREATE OR REPLACE FUNCTION ventas_comprador_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Fila que ya estaba sin comprador: no se re-audita el pasado
  IF TG_OP = 'UPDATE'
     AND OLD.socio_id IS NULL
     AND OLD.cliente_id IS NULL
     AND OLD.no_socio_nombre IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.socio_id IS NULL
     AND NEW.cliente_id IS NULL
     AND NEW.no_socio_nombre IS NULL THEN
    RAISE EXCEPTION 'La venta debe identificar a un socio o a un no socio';
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.no_socio_credencial_vencimiento IS NOT NULL
     AND NEW.no_socio_credencial_vencimiento
         < (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date THEN
    RAISE EXCEPTION 'La credencial de legítimo usuario está vencida (venció el %)',
      to_char(NEW.no_socio_credencial_vencimiento, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_comprador_guard ON ventas;
CREATE TRIGGER trg_ventas_comprador_guard
  BEFORE INSERT OR UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION ventas_comprador_guard();

COMMENT ON FUNCTION ventas_comprador_guard() IS
  'Exige comprador y credencial de legítimo usuario vigente en las ventas nuevas, sin tocar las históricas';


-- ============================================================
-- registrar_venta — se extiende con los datos del no socio
--
-- Cambia la firma: hay que borrar la de 5 argumentos, si no
-- PostgREST queda con dos overloads y no sabe cuál llamar.
-- Los GRANT no sobreviven al DROP: se rehacen al final.
-- ============================================================
DROP FUNCTION IF EXISTS registrar_venta(UUID, UUID, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION registrar_venta(
  p_punto_venta_id           UUID,
  p_cliente_id               UUID,
  p_socio_id                 UUID,
  p_metodo_pago_id           UUID,
  p_items                    JSONB,  -- [{"item_id": "uuid", "cantidad": 2}, ...]
  p_no_socio_nombre          TEXT DEFAULT NULL,
  p_no_socio_dni             TEXT DEFAULT NULL,
  p_no_socio_credencial_venc DATE DEFAULT NULL
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
  v_user_id     UUID := auth.uid();
  v_pdv         RECORD;
  v_venta_id    UUID;
  v_total       NUMERIC(12,2);
  v_items       JSONB;
  v_cat         UUID;
  v_mov_fondo   UUID;
  v_negativos   JSONB;
  v_ref         TEXT;
  v_ns_nombre   TEXT;
  v_ns_dni      TEXT;
  v_ns_venc     DATE;
  v_hoy         DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- SECURITY DEFINER => RLS no aplica: el chequeo es obligatorio acá
  IF NOT get_user_modulo_permission('ventas', 'escribir') THEN
    RAISE EXCEPTION 'No tiene permisos para registrar ventas';
  END IF;

  -- ---- Comprador: socio, cliente del histórico, o no socio ----
  IF p_socio_id IS NOT NULL OR p_cliente_id IS NOT NULL THEN
    -- No se mezclan identidades: si hay socio/cliente, lo tipeado se descarta
    v_ns_nombre := NULL;
    v_ns_dni    := NULL;
    v_ns_venc   := NULL;
  ELSE
    v_ns_nombre := NULLIF(btrim(COALESCE(p_no_socio_nombre, '')), '');
    v_ns_dni    := NULLIF(btrim(COALESCE(p_no_socio_dni, '')), '');
    v_ns_venc   := p_no_socio_credencial_venc;

    IF v_ns_nombre IS NULL OR v_ns_dni IS NULL OR v_ns_venc IS NULL THEN
      RAISE EXCEPTION 'Debe seleccionar un socio o completar nombre, DNI y vencimiento de credencial del no socio';
    END IF;

    -- La sesión corre en UTC: con CURRENT_DATE, a partir de las 21:00 ART
    -- una credencial que vence hoy ya daría vencida.
    v_hoy := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    IF v_ns_venc < v_hoy THEN
      RAISE EXCEPTION 'La credencial de legítimo usuario está vencida (venció el %)',
        to_char(v_ns_venc, 'DD/MM/YYYY');
    END IF;
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
                      metodo_pago_id, usuario_id, anulada,
                      no_socio_nombre, no_socio_dni, no_socio_credencial_vencimiento)
  VALUES (p_cliente_id, p_socio_id, p_punto_venta_id, now(), v_total,
          p_metodo_pago_id, v_user_id, false,
          v_ns_nombre, v_ns_dni, v_ns_venc)
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

-- `anon` no entra por PUBLIC: Supabase le da EXECUTE por default privileges
REVOKE ALL ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, DATE) IS
  'Registra una venta en un punto de venta (socio o no socio con credencial de legítimo usuario): cabecera, ítems, egreso de stock del PdV e ingreso en su caja';
