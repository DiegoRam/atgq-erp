-- ============================================================================
-- App móvil para socios — vínculo auth.users ↔ socios, invitaciones y API
--
-- Contexto
-- --------
-- Los socios del club (~8.400) van a instalar una app en el teléfono para ver
-- SUS PROPIAS cuotas sociales, su perfil y sus compras. Hasta esta migración
-- eso era imposible por dos razones:
--
--   1. No existía ningún vínculo entre `auth.users` y `socios`. La tabla
--      `socios` no tiene email ni teléfono ni user_id; los únicos
--      identificadores son `nro_socio` y `dni` (y el `dni` no siempre es real:
--      la migración legacy sintetizó los faltantes como dni = nro_socio).
--
--   2. El RBAC es todo-o-nada por módulo. `select_cuotas` (…000009) está
--      gateada en el permiso `socios:leer`, que es el MISMO permiso que da
--      lectura del padrón entero. Darle un rol a un socio para que vea su
--      deuda le mostraría la de los otros 8.399.
--
-- Decisión de arquitectura
-- ------------------------
-- El socio autenticado tiene **cero permisos de tabla**. No se agrega ninguna
-- política RLS sobre socios/cuotas/ventas: las políticas se OR-ean entre sí y
-- cada una nueva obliga a re-razonar si amplía el acceso de otro. En cambio,
-- toda lectura pasa por una función SECURITY DEFINER que deriva el socio
-- internamente desde auth.uid() y **no acepta ningún identificador de socio
-- como parámetro**. Sin parámetro no hay IDOR: no hay nada que manipular.
--
-- La propiedad de seguridad que sostiene el diseño, verificable en psql: un
-- usuario `authenticated` sin filas en `usuarios_roles` ve 0 filas en socios,
-- cuotas y ventas. Su JWT contra PostgREST directo devuelve []. Lo único que
-- puede hacer es llamar a las funciones de este archivo que tengan GRANT
-- EXECUTE. Auditar la seguridad de la API móvil = leer estas funciones.
--
-- Nota sobre el helper de permisos: los objetos nuevos usan
-- `permiso_modulo_todos_los_roles` (…20260812000003) y no el viejo
-- `get_user_modulo_permission` (…000009), que resuelve con LIMIT 1 sin
-- ORDER BY y elige un rol arbitrario cuando el usuario tiene más de uno.
-- ============================================================================

-- ============================================================================
-- TABLAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- socios_invitaciones — códigos de un solo uso emitidos por el club
--
-- El socio no se auto-registra: alguien del club emite un código y se lo
-- entrega. El código NUNCA se guarda en claro. Se guarda
-- sha256(codigo_normalizado || INVITACIONES_PEPPER), calculado en Node
-- (src/lib/invitaciones.ts), por tres razones:
--
--   * El pepper no toca la base. Un dump de Postgres no alcanza para fuerza
--     bruta offline: 50 bits son ~10^15 hashes, caro pero no imposible para
--     una GPU; sin el pepper, imposible.
--   * pgcrypto vive en el schema `extensions`, no en `public`. Una función
--     con `SET search_path = public` NO resuelve digest(). Hashear en SQL
--     obligaría a relajar el search_path de la función que consume el código.
--   * Emisión y validación comparten exactamente una función de hash, así que
--     no pueden divergir.
--
-- No se usa bcrypt/argon2 a propósito: el código no es una clave elegida por
-- un humano, es un token de un CSPRNG con 2^50 de espacio. Un KDF lento sólo
-- agregaría latencia al canje legítimo.
-- ----------------------------------------------------------------------------
CREATE TABLE socios_invitaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id          uuid NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  codigo_hash       bytea NOT NULL,
  -- Primeros 4 caracteres del código, en claro. Sirve para que en el mostrador
  -- se pueda identificar cuál de los códigos emitidos es el que tiene el socio
  -- en la mano, sin poder reconstruirlo (quedan 6 chars = 2^30 de incógnita).
  codigo_prefijo    text NOT NULL,
  expira_at         timestamptz NOT NULL,
  usado_at          timestamptz,
  usado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revocada_at       timestamptz,
  revocada_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creada_por        uuid NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT socios_invitaciones_prefijo_len CHECK (char_length(codigo_prefijo) = 4)
);

CREATE UNIQUE INDEX ux_socios_invitaciones_hash ON socios_invitaciones (codigo_hash);
CREATE INDEX idx_socios_invitaciones_socio ON socios_invitaciones (socio_id);

-- Red de seguridad: como máximo un código vivo por socio. `emitir_invitacion_socio`
-- ya revoca el anterior antes de insertar; este índice parcial garantiza que no
-- haya forma de saltearlo (por ejemplo desde un script con service_role). Sin
-- esto podrían coexistir dos códigos válidos y el socio no sabría cuál usar.
CREATE UNIQUE INDEX ux_socios_invitaciones_socio_viva ON socios_invitaciones (socio_id)
  WHERE usado_at IS NULL AND revocada_at IS NULL;

-- ----------------------------------------------------------------------------
-- socios_usuarios — el vínculo auth.users ↔ socios
--
-- Es 1:1 en ambas direcciones, pero con historial: los índices únicos son
-- PARCIALES sobre las filas vivas (revocado_at IS NULL). Así, desvincular una
-- cuenta deja rastro en vez de borrar la evidencia de quién tuvo acceso a los
-- datos de qué socio y durante cuánto tiempo.
--
-- socio_id va con ON DELETE RESTRICT a propósito: borrar un socio que tiene
-- una cuenta móvil activa debe fallar ruidosamente, no dejar la cuenta
-- huérfana apuntando a la nada.
-- ----------------------------------------------------------------------------
CREATE TABLE socios_usuarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  socio_id      uuid NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  invitacion_id uuid REFERENCES socios_invitaciones(id) ON DELETE SET NULL,
  vinculado_at  timestamptz NOT NULL DEFAULT now(),
  revocado_at   timestamptz,
  revocado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ux_socios_usuarios_user_activo  ON socios_usuarios (user_id)  WHERE revocado_at IS NULL;
CREATE UNIQUE INDEX ux_socios_usuarios_socio_activo ON socios_usuarios (socio_id) WHERE revocado_at IS NULL;
CREATE INDEX idx_socios_usuarios_socio ON socios_usuarios (socio_id);

-- ----------------------------------------------------------------------------
-- canje_rate_limit — freno de fuerza bruta sobre los códigos, sin Redis
--
-- El stack no tiene rate limiter ni KV, y Vercel corre lambdas sin estado
-- compartido: un contador en memoria sería un no-op (cada invocación arranca
-- con el contador en cero). La base ES el estado compartido, y un upsert por
-- intento es despreciable frente al costo del request.
--
-- La IP se guarda hasheada con el mismo pepper: esta tabla no es un registro
-- de quién intentó qué, es sólo un contador.
--
-- La cuenta que justifica los parámetros (10 intentos / 15 min, castigo 1 h):
-- el código tiene 10 caracteres de un alfabeto de 32 = 2^50 ≈ 1,1×10^15
-- combinaciones. Con ~8.400 códigos vivos, un intento al azar acierta con
-- probabilidad 7,5×10^-12. A 10 intentos cada 15 minutos por IP hacen falta
-- del orden de 10^11 IP-años para un acierto esperado. El límite no está para
-- hacer la fuerza bruta difícil: está para que no valga la pena intentarla ni
-- con una botnet.
-- ----------------------------------------------------------------------------
CREATE TABLE canje_rate_limit (
  ip_hash         bytea PRIMARY KEY,
  ventana_inicio  timestamptz NOT NULL DEFAULT now(),
  intentos        integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz
);

-- ============================================================================
-- RLS de las tablas nuevas
--
-- socios_invitaciones y canje_rate_limit quedan SIN NINGUNA POLÍTICA a
-- propósito: con RLS activa, la ausencia de política deniega todo. La pantalla
-- del ERP las lee a través de `listar_estado_app_movil`, una función DEFINER
-- que devuelve columnas whitelisteadas y nunca el codigo_hash. Mismo criterio
-- que `configuracion` en …20260812000003.
-- ============================================================================
ALTER TABLE socios_invitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios_usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE canje_rate_limit    ENABLE ROW LEVEL SECURITY;

-- socios_usuarios sí es legible (sólo lectura, sólo para quien ya puede leer
-- el padrón): la UI del ERP muestra qué socios tienen cuenta activa.
CREATE POLICY "select_socios_usuarios" ON socios_usuarios FOR SELECT TO authenticated
  USING (permiso_modulo_todos_los_roles('socios', 'leer'));

-- ============================================================================
-- INVARIANTE: un socio de la app NUNCA es staff del ERP
--
-- Es la mitigación estructural del riesgo más grave de esta feature. El
-- permiso `socios:leer` es todo-o-nada: si una cuenta móvil llegara a tener un
-- rol del ERP, su JWT dejaría de ver "sólo lo suyo" y pasaría a leer el padrón
-- completo vía PostgREST directo, sin pasar por ninguna de las funciones de
-- este archivo.
--
-- Se hace con dos triggers y no con una convención escrita en el README porque
-- una convención se olvida y un EXCEPTION no.
-- ============================================================================

CREATE OR REPLACE FUNCTION socios_usuarios_excluye_staff()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- El lock serializa este chequeo contra el del trigger espejo para el MISMO
  -- usuario. Sin él, bajo READ COMMITTED dos transacciones concurrentes (una
  -- insertando el vínculo, otra insertando el rol) no se ven entre sí: los dos
  -- EXISTS dan falso, ambas commitean, y queda una cuenta que es socio Y staff
  -- a la vez — o sea con `socios:leer`, que es lectura del padrón entero por
  -- PostgREST directo, esquivando todas las funciones mobile_*. Es la
  -- invariante que esta migración declara como su mitigación más importante,
  -- así que no puede depender de que nadie escriba las dos tablas a la vez.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  -- Sólo aplica a vínculos vivos: revocar (poner revocado_at) siempre se permite.
  IF NEW.revocado_at IS NULL
     AND EXISTS (SELECT 1 FROM usuarios_roles ur WHERE ur.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'cuenta_con_rol_erp';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_socios_usuarios_excluye_staff
  BEFORE INSERT OR UPDATE ON socios_usuarios
  FOR EACH ROW EXECUTE FUNCTION socios_usuarios_excluye_staff();

-- El espejo, que es el que más fácil se olvida. Sin este trigger,
-- `updateUsuarioRole()` en src/app/(dashboard)/security/usuarios/actions.ts le
-- asignaría alegremente el rol Administrador a la cuenta móvil de un socio
-- desde la pantalla de Seguridad, sin que nada lo impida.
CREATE OR REPLACE FUNCTION usuarios_roles_excluye_socios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mismo lock que en socios_usuarios_excluye_staff, sobre la misma clave: es
  -- lo que hace que los dos chequeos no puedan correr en paralelo para un
  -- mismo usuario. Ver el comentario largo allá.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM socios_usuarios su
     WHERE su.user_id = NEW.user_id AND su.revocado_at IS NULL
  ) THEN
    RAISE EXCEPTION 'cuenta_vinculada_a_socio';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_roles_excluye_socios
  BEFORE INSERT OR UPDATE ON usuarios_roles
  FOR EACH ROW EXECUTE FUNCTION usuarios_roles_excluye_socios();

-- ============================================================================
-- IDENTIDAD — el punto único de verdad del que cuelga todo lo demás
-- ============================================================================

-- Devuelve el socio del usuario autenticado, o NULL si no está vinculado.
-- Todas las funciones de lectura se cuelgan de ésta; ninguna acepta un
-- socio_id por parámetro.
CREATE OR REPLACE FUNCTION mobile_socio_actual()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT su.socio_id
    FROM socios_usuarios su
   WHERE su.user_id = auth.uid()
     AND su.revocado_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION mobile_socio_actual() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_socio_actual() TO authenticated;

-- Lo que llama `requireSocio` en cada request. Una sola ida y vuelta que
-- resuelve la identidad Y valida el JWT: PostgREST verifica la firma del token
-- con el secreto del proyecto ANTES de poblar auth.uid(), así que si el token
-- es inválido o venció, la llamada falla con 401 sin llegar a ejecutarse. Eso
-- ahorra una llamada extra a GoTrue (auth.getUser()) por request.
--
-- Devuelve 0 filas si el usuario no está vinculado → el helper responde 403.
CREATE OR REPLACE FUNCTION mobile_contexto_socio()
RETURNS TABLE (user_id uuid, socio_id uuid, nro_socio integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid(), su.socio_id, s.nro_socio
    FROM socios_usuarios su
    JOIN socios s ON s.id = su.socio_id
   WHERE su.user_id = auth.uid()
     AND su.revocado_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION mobile_contexto_socio() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_contexto_socio() TO authenticated;

-- ============================================================================
-- LECTURA — los datos del socio autenticado
--
-- Patrón común a todas, con dos detalles que sostienen la seguridad:
--
--   * `JOIN (SELECT mobile_socio_actual()) yo ON tabla.socio_id = yo.socio_id`
--     en vez de un WHERE con variable. Si el usuario no está vinculado,
--     mobile_socio_actual() es NULL y `socio_id = NULL` es NULL, no true: el
--     join no produce filas. Falla cerrado aunque el route handler tuviera un
--     bug y no devolviera el 403.
--
--   * El LIMIT se clampea TAMBIÉN en SQL, no sólo en el schema Zod del
--     handler, porque estas funciones son alcanzables por PostgREST directo
--     con el JWT del socio.
-- ============================================================================

CREATE OR REPLACE FUNCTION mobile_mi_perfil()
RETURNS TABLE (
  socio_id         uuid,
  nro_socio        integer,
  apellido         text,
  nombre           text,
  dni              text,
  categoria        text,
  metodo_cobranza  text,
  fecha_alta       date,
  fecha_baja       date,
  activo           boolean,
  antiguedad_meses integer,
  localidad        text,
  email            text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id,
    s.nro_socio,
    s.apellido,
    s.nombre,
    s.dni,
    cs.nombre,
    mc.nombre,
    s.fecha_alta,
    s.fecha_baja,
    -- "Activo" en este sistema es fecha_baja NULL **y** una categoría que
    -- cuenta como activa (cuenta_como_activo, …20260806000001). Ver el
    -- comentario en src/types/socios.ts.
    (s.fecha_baja IS NULL AND cs.cuenta_como_activo),
    -- Antigüedad SIEMPRE calculada, nunca almacenada (convención del repo).
    (EXTRACT(YEAR  FROM age(COALESCE(s.fecha_baja, CURRENT_DATE), s.fecha_alta)) * 12
   + EXTRACT(MONTH FROM age(COALESCE(s.fecha_baja, CURRENT_DATE), s.fecha_alta)))::integer,
    s.localidad,
    u.email::text
  FROM socios s
  JOIN (SELECT mobile_socio_actual() AS socio_id) yo ON s.id = yo.socio_id
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
  LEFT JOIN metodos_cobranza mc ON mc.id = s.metodo_cobranza_id
  LEFT JOIN auth.users u ON u.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_perfil() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_perfil() TO authenticated;

-- El caso de uso central de la app: qué cuotas debo y cuáles pagué.
-- `total_filas` viene de count(*) OVER (), que se evalúa antes del LIMIT, así
-- que la paginación se resuelve en una sola query en vez de dos.
CREATE OR REPLACE FUNCTION mobile_mis_cuotas(
  p_estado text    DEFAULT 'todas',   -- 'todas' | 'impagas' | 'pagas'
  p_desde  date    DEFAULT NULL,
  p_hasta  date    DEFAULT NULL,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  periodo     date,
  monto       numeric,
  pagada      boolean,
  fecha_pago  timestamptz,
  tipo_cuota  text,
  metodo_pago text,
  total_filas bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.periodo, c.monto, c.pagada, c.fecha_pago,
    tc.nombre, mc.nombre,
    count(*) OVER ()
  FROM cuotas c
  JOIN (SELECT mobile_socio_actual() AS socio_id) yo ON c.socio_id = yo.socio_id
  JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
  LEFT JOIN metodos_cobranza mc ON mc.id = c.metodo_pago_id
  WHERE (
          p_estado = 'todas'
       OR (p_estado = 'impagas' AND NOT c.pagada)
       OR (p_estado = 'pagas'   AND     c.pagada)
        )
    AND (p_desde IS NULL OR c.periodo >= p_desde)
    AND (p_hasta IS NULL OR c.periodo <= p_hasta)
  -- Desempate por id: sin él, dos cuotas del mismo período pueden alternar de
  -- orden entre páginas y una fila aparece dos veces o ninguna.
  ORDER BY c.periodo DESC, c.id
  LIMIT  least(greatest(coalesce(p_limit, 50), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE EXECUTE ON FUNCTION mobile_mis_cuotas(text, date, date, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mis_cuotas(text, date, date, integer, integer) TO authenticated;

-- La pantalla de inicio de la app. Se agrega en SQL y no en JS a propósito:
-- sumar NUMERIC(12,2) en JavaScript los convierte a float64 y el total puede
-- diferir en centavos del que muestra el ERP.
CREATE OR REPLACE FUNCTION mobile_mi_resumen_cuotas()
RETURNS TABLE (
  cuotas_impagas  integer,
  monto_adeudado  numeric,
  cuotas_pagadas  integer,
  ultimo_periodo_pagado date,
  primer_periodo_impago date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    count(*) FILTER (WHERE NOT c.pagada)::integer,
    COALESCE(sum(c.monto) FILTER (WHERE NOT c.pagada), 0),
    count(*) FILTER (WHERE c.pagada)::integer,
    max(c.periodo) FILTER (WHERE c.pagada),
    min(c.periodo) FILTER (WHERE NOT c.pagada)
  FROM cuotas c
  JOIN (SELECT mobile_socio_actual() AS socio_id) yo ON c.socio_id = yo.socio_id;
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_resumen_cuotas() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_resumen_cuotas() TO authenticated;

-- Compras del socio. `ventas.socio_id` ES el comprador; `ventas.usuario_id` es
-- el cajero que registró la venta — no confundirlos.
-- Las anuladas no se muestran: para el socio no existieron.
CREATE OR REPLACE FUNCTION mobile_mis_compras(
  p_desde  timestamptz DEFAULT NULL,
  p_hasta  timestamptz DEFAULT NULL,
  p_limit  integer     DEFAULT 50,
  p_offset integer     DEFAULT 0
)
RETURNS TABLE (
  id           uuid,
  fecha        timestamptz,
  total        numeric,
  metodo_pago  text,
  punto_venta  text,
  cantidad_items integer,
  total_filas  bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    v.id, v.fecha, v.total, mc.nombre, d.nombre,
    COALESCE((SELECT sum(vi.cantidad)::integer FROM ventas_items vi WHERE vi.venta_id = v.id), 0),
    count(*) OVER ()
  FROM ventas v
  JOIN (SELECT mobile_socio_actual() AS socio_id) yo ON v.socio_id = yo.socio_id
  -- Desambiguación de FK obligatoria: `ventas` tiene más de una FK hacia estas
  -- tablas, igual que en getVentas (src/app/(dashboard)/ventas/actions.ts).
  LEFT JOIN metodos_cobranza mc ON mc.id = v.metodo_pago_id
  LEFT JOIN depositos d ON d.id = v.punto_venta_id
  WHERE NOT v.anulada
    AND (p_desde IS NULL OR v.fecha >= p_desde)
    AND (p_hasta IS NULL OR v.fecha <= p_hasta)
  ORDER BY v.fecha DESC, v.id
  LIMIT  least(greatest(coalesce(p_limit, 50), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE EXECUTE ON FUNCTION mobile_mis_compras(timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mis_compras(timestamptz, timestamptz, integer, integer) TO authenticated;

-- Detalle de una compra. Devuelve jsonb (y no RETURNS TABLE) porque la forma
-- es anidada: cabecera + ítems.
--
-- Devuelve NULL si la venta no existe O no es del socio autenticado: el
-- handler mapea NULL a 404, nunca a 403. Un 403 confirmaría que el uuid existe
-- y pertenece a otro, que es justo lo que no queremos decirle a nadie.
-- Los precios salen de ventas_items (congelados al momento de la venta), no de
-- items_ventas (que cambian con el tiempo).
CREATE OR REPLACE FUNCTION mobile_mi_compra_detalle(p_venta_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id',          v.id,
    'fecha',       v.fecha,
    'total',       v.total,
    'metodo_pago', mc.nombre,
    'punto_venta', d.nombre,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'nombre',          iv.nombre,
               'cantidad',        vi.cantidad,
               'precio_unitario', vi.precio_unitario,
               'subtotal',        vi.subtotal
             ) ORDER BY iv.nombre)
        FROM ventas_items vi
        JOIN items_ventas iv ON iv.id = vi.item_id
       WHERE vi.venta_id = v.id
    ), '[]'::jsonb)
  )
  FROM ventas v
  JOIN (SELECT mobile_socio_actual() AS socio_id) yo ON v.socio_id = yo.socio_id
  LEFT JOIN metodos_cobranza mc ON mc.id = v.metodo_pago_id
  LEFT JOIN depositos d ON d.id = v.punto_venta_id
  WHERE v.id = p_venta_id
    AND NOT v.anulada;
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_compra_detalle(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_compra_detalle(uuid) TO authenticated;

-- ============================================================================
-- GRUPO FAMILIAR — datos de terceros, la parte más delicada
--
-- Regla: SÓLO el titular del grupo ve las cuotas del grupo. Si el grupo no
-- tiene titular designado, no lo ve nadie.
--
-- El fail-closed con titular_id NULL es deliberado. En los datos migrados del
-- sistema legacy puede haber grupos sin titular, y es tentador inferirlo (el
-- socio más antiguo, el de menor nro_socio, cualquier miembro). Inferir sería
-- inventar una regla de autorización, y el costo de equivocarse es mostrarle a
-- alguien la deuda de un tercero. Para que esto no se vuelva un ticket de
-- soporte irresoluble, la pantalla /socios/grupos-familiares del ERP tiene un
-- filtro "Sin titular" que permite corregirlos.
--
-- Minimización de datos: el RETURNS TABLE es una whitelist explícita. De los
-- otros miembros del grupo NO se expone dni, fecha_nacimiento, localidad ni
-- método de cobranza — no hacen falta para el caso de uso y son PII ajena.
-- Nunca SELECT *.
-- ============================================================================

-- Resuelve y valida el grupo del socio autenticado. Las dos funciones públicas
-- del grupo llaman a ésta, así que la regla de autorización está escrita una
-- sola vez.
CREATE OR REPLACE FUNCTION mobile_mi_grupo_titular()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_socio   uuid := mobile_socio_actual();
  v_grupo   uuid;
  v_titular uuid;
BEGIN
  IF v_socio IS NULL THEN
    RAISE EXCEPTION 'cuenta_no_vinculada';
  END IF;

  SELECT s.grupo_familiar_id INTO v_grupo FROM socios s WHERE s.id = v_socio;
  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'sin_grupo_familiar';
  END IF;

  SELECT g.titular_id INTO v_titular FROM grupos_familiares g WHERE g.id = v_grupo;
  IF v_titular IS NULL THEN
    RAISE EXCEPTION 'grupo_sin_titular';
  END IF;
  IF v_titular <> v_socio THEN
    RAISE EXCEPTION 'no_es_titular';
  END IF;

  RETURN v_grupo;
END;
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_grupo_titular() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_grupo_titular() TO authenticated;

CREATE OR REPLACE FUNCTION mobile_mi_grupo_familiar()
RETURNS TABLE (
  grupo_id          uuid,
  socio_id          uuid,
  es_usuario_actual boolean,
  nro_socio         integer,
  apellido          text,
  nombre            text,
  categoria         text,
  cuotas_impagas    integer,
  monto_adeudado    numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grupo uuid := mobile_mi_grupo_titular();
  v_socio uuid := mobile_socio_actual();
BEGIN
  RETURN QUERY
  SELECT
    v_grupo, s.id, (s.id = v_socio),
    s.nro_socio, s.apellido, s.nombre, cs.nombre,
    count(c.id) FILTER (WHERE NOT c.pagada)::integer,
    COALESCE(sum(c.monto) FILTER (WHERE NOT c.pagada), 0)
  FROM socios s
  JOIN categorias_sociales cs ON cs.id = s.categoria_id
  LEFT JOIN cuotas c ON c.socio_id = s.id
  WHERE s.grupo_familiar_id = v_grupo
  GROUP BY s.id, s.nro_socio, s.apellido, s.nombre, cs.nombre
  ORDER BY (s.id = v_socio) DESC, s.apellido, s.nombre;
END;
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_grupo_familiar() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_grupo_familiar() TO authenticated;

-- Repite el chequeo de titular vía mobile_mi_grupo_titular(); no confía en que
-- el handler ya lo haya hecho al pedir el listado del grupo.
CREATE OR REPLACE FUNCTION mobile_mi_grupo_familiar_cuotas(
  p_estado text    DEFAULT 'todas',
  p_desde  date    DEFAULT NULL,
  p_hasta  date    DEFAULT NULL,
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  socio_id    uuid,
  nro_socio   integer,
  apellido    text,
  nombre      text,
  periodo     date,
  monto       numeric,
  pagada      boolean,
  fecha_pago  timestamptz,
  tipo_cuota  text,
  total_filas bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grupo uuid := mobile_mi_grupo_titular();
BEGIN
  RETURN QUERY
  SELECT
    c.id, s.id, s.nro_socio, s.apellido, s.nombre,
    c.periodo, c.monto, c.pagada, c.fecha_pago, tc.nombre,
    count(*) OVER ()
  FROM cuotas c
  JOIN socios s ON s.id = c.socio_id
  JOIN tipos_cuotas tc ON tc.id = c.tipo_cuota_id
  WHERE s.grupo_familiar_id = v_grupo
    AND (
          p_estado = 'todas'
       OR (p_estado = 'impagas' AND NOT c.pagada)
       OR (p_estado = 'pagas'   AND     c.pagada)
        )
    AND (p_desde IS NULL OR c.periodo >= p_desde)
    AND (p_hasta IS NULL OR c.periodo <= p_hasta)
  ORDER BY c.periodo DESC, s.apellido, s.nombre, c.id
  LIMIT  least(greatest(coalesce(p_limit, 50), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION mobile_mi_grupo_familiar_cuotas(text, date, date, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mobile_mi_grupo_familiar_cuotas(text, date, date, integer, integer) TO authenticated;

-- ============================================================================
-- EMISIÓN DE INVITACIONES — lo llama el ERP, gateado por RBAC
--
-- Los gates van DENTRO de las funciones y no sólo en el server action de
-- TypeScript, así valen también si alguien llama la RPC directo con su JWT.
-- ============================================================================

CREATE OR REPLACE FUNCTION emitir_invitacion_socio(
  p_socio_id    uuid,
  p_codigo_hash bytea,
  p_prefijo     text,
  p_dias        integer DEFAULT 14
)
RETURNS TABLE (invitacion_id uuid, expira_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;
  IF NOT permiso_modulo_todos_los_roles('socios', 'escribir') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;
  IF p_dias < 1 OR p_dias > 90 THEN
    RAISE EXCEPTION 'dias_fuera_de_rango';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM socios s WHERE s.id = p_socio_id) THEN
    RAISE EXCEPTION 'socio_inexistente';
  END IF;
  IF EXISTS (
    SELECT 1 FROM socios_usuarios su
     WHERE su.socio_id = p_socio_id AND su.revocado_at IS NULL
  ) THEN
    RAISE EXCEPTION 'socio_ya_vinculado';
  END IF;

  -- Reemitir invalida el código anterior. Sin esto quedarían dos códigos vivos
  -- y el socio no sabría cuál usar (además el índice parcial único rebotaría
  -- el insert de abajo).
  UPDATE socios_invitaciones
     SET revocada_at = now(), revocada_por = v_user
   WHERE socio_id = p_socio_id
     AND usado_at IS NULL
     AND revocada_at IS NULL;

  RETURN QUERY
  INSERT INTO socios_invitaciones (socio_id, codigo_hash, codigo_prefijo, expira_at, creada_por)
  VALUES (p_socio_id, p_codigo_hash, p_prefijo, now() + make_interval(days => p_dias), v_user)
  RETURNING socios_invitaciones.id, socios_invitaciones.expira_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION emitir_invitacion_socio(uuid, bytea, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION emitir_invitacion_socio(uuid, bytea, text, integer) TO authenticated;

-- Emisión masiva. Un solo round-trip para hasta 1.000 socios: hacer 1.000
-- llamadas a emitir_invitacion_socio desde el server action tardaría minutos y
-- se comería el timeout de la lambda.
-- p_items: [{"socio_id": "...", "codigo_hash": "\\x...", "prefijo": "ABCD"}, ...]
CREATE OR REPLACE FUNCTION emitir_invitaciones_socios(
  p_items jsonb,
  p_dias  integer DEFAULT 14
)
RETURNS TABLE (socio_id uuid, invitacion_id uuid, expira_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cant integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;
  IF NOT permiso_modulo_todos_los_roles('socios', 'escribir') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;
  IF p_dias < 1 OR p_dias > 90 THEN
    RAISE EXCEPTION 'dias_fuera_de_rango';
  END IF;

  SELECT count(*) INTO v_cant FROM jsonb_array_elements(p_items);
  IF v_cant > 1000 THEN
    RAISE EXCEPTION 'lote_demasiado_grande';
  END IF;

  -- Dos sentencias secuenciales, no un CTE que modifique datos: dentro de un
  -- único statement, el INSERT no vería el efecto del UPDATE que revoca, y el
  -- índice parcial ux_socios_invitaciones_socio_viva rebotaría. Tampoco una
  -- TEMP TABLE, que fallaría al llamar la función dos veces en la misma
  -- transacción.
  UPDATE socios_invitaciones i
     SET revocada_at = now(), revocada_por = v_user
   WHERE i.usado_at IS NULL
     AND i.revocada_at IS NULL
     AND i.socio_id IN (
       SELECT x.socio_id FROM jsonb_to_recordset(p_items) AS x(socio_id uuid)
     );

  -- Los socios ya vinculados se saltean en silencio: en un lote de 1.000 es
  -- esperable que alguno ya tenga cuenta, y no es un error del operador. El
  -- server action compara lo que pidió contra lo que devuelve esta función.
  RETURN QUERY
  INSERT INTO socios_invitaciones (socio_id, codigo_hash, codigo_prefijo, expira_at, creada_por)
  SELECT x.socio_id, x.codigo_hash, x.prefijo, now() + make_interval(days => p_dias), v_user
    FROM jsonb_to_recordset(p_items) AS x(socio_id uuid, codigo_hash bytea, prefijo text)
   WHERE NOT EXISTS (
     SELECT 1 FROM socios_usuarios su
      WHERE su.socio_id = x.socio_id AND su.revocado_at IS NULL
   )
  RETURNING socios_invitaciones.socio_id, socios_invitaciones.id, socios_invitaciones.expira_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION emitir_invitaciones_socios(jsonb, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION emitir_invitaciones_socios(jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION revocar_invitacion_socio(p_socio_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_n    integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;
  IF NOT permiso_modulo_todos_los_roles('socios', 'escribir') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  UPDATE socios_invitaciones
     SET revocada_at = now(), revocada_por = v_user
   WHERE socio_id = p_socio_id
     AND usado_at IS NULL
     AND revocada_at IS NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION revocar_invitacion_socio(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION revocar_invitacion_socio(uuid) TO authenticated;

-- Desvincular corta el acceso de una cuenta móvil. Requiere socios:eliminar
-- porque le saca el acceso a un socio, no es una operación de rutina.
--
-- Devuelve el user_id para que el server action pueda además banear la cuenta
-- en Auth: revocar la fila sola deja el JWT vigente hasta que expire (1 h), y
-- durante esa hora las funciones ya devuelven vacío, pero el token sigue
-- siendo un token válido del proyecto.
CREATE OR REPLACE FUNCTION desvincular_cuenta_socio(p_socio_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_target  uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_autenticado';
  END IF;
  IF NOT permiso_modulo_todos_los_roles('socios', 'eliminar') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  UPDATE socios_usuarios
     SET revocado_at = now(), revocado_por = v_user
   WHERE socio_id = p_socio_id
     AND revocado_at IS NULL
  RETURNING user_id INTO v_target;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'sin_cuenta_vinculada';
  END IF;

  RETURN v_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION desvincular_cuenta_socio(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION desvincular_cuenta_socio(uuid) TO authenticated;

-- Alimenta la pantalla /socios/app-movil. Nunca devuelve codigo_hash.
CREATE OR REPLACE FUNCTION listar_estado_app_movil(
  p_search text    DEFAULT NULL,
  p_estado text    DEFAULT 'todos',  -- 'todos'|'sin_codigo'|'codigo_vigente'|'codigo_vencido'|'vinculado'
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  socio_id       uuid,
  nro_socio      integer,
  apellido       text,
  nombre         text,
  dni            text,
  estado         text,
  codigo_prefijo text,
  expira_at      timestamptz,
  email          text,
  vinculado_at   timestamptz,
  ultimo_acceso  timestamptz,
  total_filas    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT permiso_modulo_todos_los_roles('socios', 'leer') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id, s.nro_socio, s.apellido, s.nombre, s.dni,
      su.vinculado_at, u.email::text AS email, u.last_sign_in_at,
      i.codigo_prefijo, i.expira_at,
      CASE
        WHEN su.id IS NOT NULL                      THEN 'vinculado'
        WHEN i.id IS NULL                           THEN 'sin_codigo'
        WHEN i.expira_at > now()                    THEN 'codigo_vigente'
        ELSE                                             'codigo_vencido'
      END AS estado
    FROM socios s
    LEFT JOIN socios_usuarios su
           ON su.socio_id = s.id AND su.revocado_at IS NULL
    LEFT JOIN auth.users u ON u.id = su.user_id
    LEFT JOIN socios_invitaciones i
           ON i.socio_id = s.id AND i.usado_at IS NULL AND i.revocada_at IS NULL
  )
  SELECT
    b.id, b.nro_socio, b.apellido, b.nombre, b.dni,
    b.estado, b.codigo_prefijo, b.expira_at,
    b.email, b.vinculado_at, b.last_sign_in_at,
    count(*) OVER ()
  FROM base b
  WHERE (p_estado = 'todos' OR b.estado = p_estado)
    AND (
      p_search IS NULL OR p_search = '' OR
      b.apellido ILIKE '%' || p_search || '%' OR
      b.nombre   ILIKE '%' || p_search || '%' OR
      b.dni      ILIKE '%' || p_search || '%' OR
      b.nro_socio::text = p_search
    )
  ORDER BY b.apellido, b.nombre, b.nro_socio
  LIMIT  least(greatest(coalesce(p_limit, 50), 1), 200)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION listar_estado_app_movil(text, text, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION listar_estado_app_movil(text, text, integer, integer) TO authenticated;

-- Candidatos para la emisión masiva.
--
-- Función aparte de `listar_estado_app_movil` y no un parámetro más de aquélla:
-- la de listado está paginada para una pantalla (clamp de 200) y ésta tiene que
-- devolver el lote entero. Mezclarlas hacía que la emisión masiva heredara en
-- silencio el tope de la pantalla y sólo emitiera para los primeros 200 socios.
--
-- El filtro por categoría va ACÁ y no en el server action: filtrar en JS lo que
-- devuelve una consulta ya paginada da "los socios de esta categoría que además
-- caen en la primera página", que para una categoría de cientos de socios son
-- unos pocos o ninguno.
--
-- Incluye tanto a los que nunca tuvieron código como a los que lo tienen
-- vencido: reemitir revoca el anterior, así que un código vencido no es motivo
-- para excluir a nadie del lote (si no, sólo se lo podría arreglar de a uno).
CREATE OR REPLACE FUNCTION listar_socios_para_emision(
  p_categoria_id uuid    DEFAULT NULL,
  p_limit        integer DEFAULT 1000
)
RETURNS TABLE (
  socio_id  uuid,
  nro_socio integer,
  apellido  text,
  nombre    text,
  categoria text,
  vencido   boolean,
  total_candidatos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT permiso_modulo_todos_los_roles('socios', 'escribir') THEN
    RAISE EXCEPTION 'sin_permiso';
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT s.id, s.nro_socio, s.apellido, s.nombre, cs.nombre AS categoria,
           (i.id IS NOT NULL) AS vencido
      FROM socios s
      JOIN categorias_sociales cs ON cs.id = s.categoria_id
      LEFT JOIN socios_invitaciones i
             ON i.socio_id = s.id
            AND i.usado_at IS NULL
            AND i.revocada_at IS NULL
     WHERE NOT EXISTS (
             SELECT 1 FROM socios_usuarios su
              WHERE su.socio_id = s.id AND su.revocado_at IS NULL
           )
       -- sin código vivo, o con uno ya vencido
       AND (i.id IS NULL OR i.expira_at <= now())
       AND (p_categoria_id IS NULL OR s.categoria_id = p_categoria_id)
       -- Un socio dado de baja no necesita acceso a la app.
       AND s.fecha_baja IS NULL
  )
  SELECT c.id, c.nro_socio, c.apellido, c.nombre, c.categoria, c.vencido,
         count(*) OVER ()
    FROM candidatos c
   ORDER BY c.apellido, c.nombre, c.nro_socio
   LIMIT least(greatest(coalesce(p_limit, 1000), 1), 1000);
END;
$$;

REVOKE EXECUTE ON FUNCTION listar_socios_para_emision(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION listar_socios_para_emision(uuid, integer) TO authenticated;

-- ============================================================================
-- CANJE — sólo service_role
--
-- Estas cuatro funciones toman parámetros que no se pueden confiar a un
-- usuario final (p_user_id, p_ip_hash). Si `authenticated` pudiera llamarlas,
-- cualquier socio ya logueado podría vincular la cuenta de otro, o limpiar su
-- propio contador de rate limit y hacer fuerza bruta sin freno.
--
-- Por eso van revocadas de PUBLIC, anon Y authenticated: el único camino es el
-- route handler, que corre con service_role y donde vive el rate limiter. Así
-- el limiter no se puede saltear yendo directo a PostgREST.
--
-- Ojo: Supabase concede ALL ON FUNCTIONS a anon y authenticated por default
-- privileges del schema public. Un REVOKE ... FROM PUBLIC a secas NO alcanza,
-- porque el grant de cada rol le sobrevive. Hay que nombrarlos.
-- ============================================================================

-- Valida sin consumir. El estado devuelto es lo que permite distinguir
-- "código inexistente" de "código vencido" SÓLO cuando el hash matcheó, o sea
-- cuando quien llama ya demostró conocer un código real. Para un hash que no
-- existe devuelve 'inexistente' y nada más: no es un oráculo.
CREATE OR REPLACE FUNCTION mobile_validar_invitacion(p_codigo_hash bytea)
RETURNS TABLE (
  estado    text,   -- 'valida'|'expirada'|'usada'|'revocada'|'inexistente'
  socio_id  uuid,
  nro_socio integer,
  apellido  text,
  nombre    text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    CASE
      WHEN i.id IS NULL            THEN 'inexistente'
      WHEN i.revocada_at IS NOT NULL THEN 'revocada'
      WHEN i.usado_at    IS NOT NULL THEN 'usada'
      WHEN i.expira_at  <= now()     THEN 'expirada'
      ELSE 'valida'
    END,
    s.id, s.nro_socio, s.apellido, s.nombre
  FROM (SELECT 1) dummy
  LEFT JOIN socios_invitaciones i ON i.codigo_hash = p_codigo_hash
  LEFT JOIN socios s ON s.id = i.socio_id;
$$;

REVOKE EXECUTE ON FUNCTION mobile_validar_invitacion(bytea) FROM PUBLIC, anon, authenticated;

-- El canje propiamente dicho.
--
-- El "un solo uso" vive en el UPDATE ... WHERE usado_at IS NULL ... RETURNING,
-- que es una sola sentencia y NO un SELECT seguido de un UPDATE. Con dos
-- canjes concurrentes del mismo código, el segundo espera el lock de la fila,
-- reevalúa `usado_at IS NULL` después de soltarlo, lo encuentra falso y no
-- matchea ninguna fila.
--
-- El INSERT en socios_usuarios va en la misma transacción: si el socio ya
-- estaba vinculado, el índice parcial único rebota y el rollback deshace
-- también el consumo del código.
CREATE OR REPLACE FUNCTION mobile_canjear_invitacion(p_codigo_hash bytea, p_user_id uuid)
RETURNS TABLE (socio_id uuid, nro_socio integer, apellido text, nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv socios_invitaciones%ROWTYPE;
BEGIN
  UPDATE socios_invitaciones i
     SET usado_at = now(), usado_por_user_id = p_user_id
   WHERE i.codigo_hash = p_codigo_hash
     AND i.usado_at    IS NULL
     AND i.revocada_at IS NULL
     AND i.expira_at   > now()
  RETURNING i.* INTO v_inv;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'codigo_invalido';
  END IF;

  INSERT INTO socios_usuarios (user_id, socio_id, invitacion_id)
  VALUES (p_user_id, v_inv.socio_id, v_inv.id);

  RETURN QUERY
  SELECT s.id, s.nro_socio, s.apellido, s.nombre
    FROM socios s
   WHERE s.id = v_inv.socio_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION mobile_canjear_invitacion(bytea, uuid) FROM PUBLIC, anon, authenticated;

-- Ventana deslizante de 15 minutos, 10 intentos, castigo de 1 hora.
-- Devuelve si el intento debe rechazarse y en cuántos segundos reintentar.
CREATE OR REPLACE FUNCTION registrar_intento_canje(p_ip_hash bytea)
RETURNS TABLE (bloqueado boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row canje_rate_limit%ROWTYPE;
BEGIN
  -- Purga oportunista: sin esto la tabla crece de forma monótona (sólo se
  -- borraba una fila en el canje exitoso, que es el caso raro). Una fila cuya
  -- ventana venció hace más de un día y que no está bloqueada ya no aporta
  -- nada. Va acá y no en un cron porque el proyecto no tiene pg_cron activo.
  DELETE FROM canje_rate_limit
   WHERE ventana_inicio < now() - interval '1 day'
     AND (bloqueado_hasta IS NULL OR bloqueado_hasta <= now());

  INSERT INTO canje_rate_limit (ip_hash, ventana_inicio, intentos)
  VALUES (p_ip_hash, now(), 1)
  ON CONFLICT (ip_hash) DO UPDATE
    SET
      -- Si la ventana venció, arranca una nueva; si no, acumula.
      ventana_inicio = CASE
        WHEN canje_rate_limit.bloqueado_hasta IS NOT NULL
             AND canje_rate_limit.bloqueado_hasta > now() THEN canje_rate_limit.ventana_inicio
        WHEN canje_rate_limit.ventana_inicio < now() - interval '15 minutes' THEN now()
        ELSE canje_rate_limit.ventana_inicio
      END,
      intentos = CASE
        WHEN canje_rate_limit.bloqueado_hasta IS NOT NULL
             AND canje_rate_limit.bloqueado_hasta > now() THEN canje_rate_limit.intentos
        WHEN canje_rate_limit.ventana_inicio < now() - interval '15 minutes' THEN 1
        ELSE canje_rate_limit.intentos + 1
      END
  RETURNING * INTO v_row;

  -- Alcanzó el tope dentro de la ventana → castigo de 1 h.
  IF v_row.intentos > 10 AND (v_row.bloqueado_hasta IS NULL OR v_row.bloqueado_hasta <= now()) THEN
    UPDATE canje_rate_limit
       SET bloqueado_hasta = now() + interval '1 hour'
     WHERE ip_hash = p_ip_hash
    RETURNING * INTO v_row;
  END IF;

  IF v_row.bloqueado_hasta IS NOT NULL AND v_row.bloqueado_hasta > now() THEN
    RETURN QUERY SELECT true, GREATEST(EXTRACT(EPOCH FROM (v_row.bloqueado_hasta - now()))::integer, 1);
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION registrar_intento_canje(bytea) FROM PUBLIC, anon, authenticated;

-- Se llama tras un canje exitoso: el que tenía un código válido no es un
-- atacante, y no queremos que una familia detrás de un NAT compartido se
-- bloquee entre sí al activar varias cuentas seguidas.
CREATE OR REPLACE FUNCTION limpiar_intento_canje(p_ip_hash bytea)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM canje_rate_limit WHERE ip_hash = p_ip_hash;
$$;

REVOKE EXECUTE ON FUNCTION limpiar_intento_canje(bytea) FROM PUBLIC, anon, authenticated;
