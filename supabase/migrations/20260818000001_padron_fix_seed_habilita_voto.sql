-- RESEED-STATUS: reproducido en reseed_post_migracion.sql (fragmentos 2 y 3)
--   habilita_voto y afecta_padron son política del club: no existen en el dump
--   legacy, así que una re-migración los borra y esta migración no se re-ejecuta.
--   El reseed los repone por id determinista. Esta migración arregla la base de
--   HOY; el reseed cubre las re-migraciones futuras. Ver migration/README.md.
-- ============================================================
-- Padrón electoral — arreglo del seed de habilita_voto
--
-- 20260817000001_padron_electoral.sql sembró habilita_voto matcheando por
-- nombre contra una lista escrita a mano. Dos de las ocho categorías que el
-- club habilitó NUNCA matchearon, y siguen sin matchear en producción:
--
--   'Grupo Familiar'                      el seed buscaba 'GRUPO FAMILIA' (sin la R)
--   'Grupo Fliar. Miembro  - Ventanilla'  el seed buscaba 'GRUPO FLIAR. MIEMBRO-VENTANILLA';
--                                         el nombre real tiene DOBLE espacio después de
--                                         "Miembro" y el guion espaciado (" - ")
--
-- Consecuencia medida: 15 socios sin fecha de baja (12 en 'Grupo Familiar' +
-- 3 en 'Grupo Fliar. Miembro  - Ventanilla') quedaron excluidos del padrón
-- electoral. El padrón se usa en las asambleas: son 15 personas que no pueden
-- votar por un typo, y el error no se ve hasta el día de la asamblea.
--
-- POR QUÉ NO SALTÓ EL GUARD (el bug de fondo, más grave que el typo). El guard
-- del archivo original era:
--     IF (SELECT count(*) FROM categorias_sociales WHERE habilita_voto) = 0
--        THEN RAISE EXCEPTION ...
-- Verifica que matcheó ALGO, no que matchearon LAS OCHO. Con 6 de 8 el count
-- daba 6, 6 <> 0, y la migración aplicó "OK". Los comentarios de ese archivo
-- prometían un seed que falla ruidoso; el guard escrito no lo cumplía. Acá se
-- endurece: se verifica cobertura de las 8 identidades esperadas, una por una,
-- y el mensaje de error dice CUÁLES faltan.
--
-- ALCANCE. Esto es un fix de datos de UNA SOLA VEZ sobre el estado actual, no
-- un invariante permanente: habilita_voto es editable desde
-- /socios/config/categorias, y si algún día se repuebla categorias_sociales
-- (re-migración del legacy) esta migración ya está en el ledger y no vuelve a
-- correr — reponer el estado es responsabilidad de ese proceso.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Criterio de identificación: id determinista OR nombre normalizado
--
-- Por qué NO sólo por nombre literal: es exactamente lo que falló. El nombre
-- se transcribe a mano en el archivo y además se puede editar desde el CRUD;
-- y el de 'Grupo Fliar. Miembro  - Ventanilla' tiene espacios invisibles que
-- nadie detecta releyendo el diff.
--
-- Por qué NO sólo por id: los uuid5 de abajo existen únicamente si la fila
-- vino del migrador del legacy (uuid5 con namespace
-- a1b2c3d4-0000-4000-8000-a7a7a7a70001 y clave 'categorias_sociales:<id_legacy>').
-- Una categoría creada desde el CRUD, o una base sembrada con
-- supabase/seed.sql, tiene uuid v4 aleatorio: por id solo, esta migración
-- sería un no-op silencioso justo en las bases de desarrollo.
--
-- Por eso se combinan con OR:
--   · el id cubre el caso "la renombraron desde el CRUD",
--   · el nombre normalizado cubre el caso "la fila no viene del legacy".
-- La normalización colapsa espacios repetidos, convierte el NBSP (chr(160))
-- en espacio y saca los espacios alrededor del guion, que es la clase exacta
-- de defecto que causó este bug.
--
-- El riesgo del OR es marcar de más. Está acotado: es un seed que se evalúa
-- UNA vez contra un estado conocido, no un predicado de runtime, y ninguno de
-- los dos criterios alcanza a las categorías que no votan (verificado contra
-- una copia del padrón de producción: Cadete, Cadete-Ventanilla, Adherente,
-- Adherente-Ventanilla, Inactivo, BAJA, Escuela, Vitalicio-Ventanilla y
-- Honorario-Ventanilla quedan en false).
-- ------------------------------------------------------------

DROP TABLE IF EXISTS tmp_padron_esperadas;
CREATE TEMP TABLE tmp_padron_esperadas (
  slot        text NOT NULL,  -- identidad lógica; es lo que se nombra si falta
  id_legacy   uuid NOT NULL,  -- uuid5(NS, 'categorias_sociales:<id_legacy>')
  nombre_norm text NOT NULL   -- nombre aceptado, ya normalizado
);

-- Un slot puede tener más de un nombre aceptado (misma categoría, distinta
-- grafía según de dónde salieron los datos). 'Grupo Familiar' es el caso:
-- así se llama en el legacy y en producción, pero supabase/seed.sql la creó
-- como 'Grupo Familia' — el mismo typo que se coló en el seed original.
INSERT INTO tmp_padron_esperadas (slot, id_legacy, nombre_norm) VALUES
  ('Activo',                             '8afa4fe8-b3aa-5d57-be5d-703732fe9cad', 'ACTIVO'),                     -- id_legacy 3
  ('Vitalicio',                          '2c774b62-8921-54ec-b68b-9ce47295599a', 'VITALICIO'),                  -- id_legacy 4
  ('Honorario',                          '499f21a5-877d-5fa7-8b95-8fa2be1ac8f3', 'HONORARIO'),                  -- id_legacy 6
  ('Grupo Familiar',                     'd0df2807-a5c5-510c-8f8d-9085adbde1bf', 'GRUPO FAMILIAR'),             -- id_legacy 12  <- faltaba
  ('Grupo Familiar',                     'd0df2807-a5c5-510c-8f8d-9085adbde1bf', 'GRUPO FAMILIA'),              -- alias de supabase/seed.sql
  ('Activo-Ventanilla',                  '721649cb-dcd8-528e-b34d-54bc443ae43e', 'ACTIVO-VENTANILLA'),          -- id_legacy 13
  ('Grupo Familiar-Ventanilla',          '82124670-1178-529f-97f9-04de86c3319d', 'GRUPO FAMILIAR-VENTANILLA'),  -- id_legacy 16
  ('Grupo Fliar. Miembro',               '4f3ad3be-1b2b-5b93-87c8-6b8bf2ad2b02', 'GRUPO FLIAR. MIEMBRO'),       -- id_legacy 20
  ('Grupo Fliar. Miembro  - Ventanilla', 'dee95915-198c-5de2-bf46-2b242727c36d', 'GRUPO FLIAR. MIEMBRO-VENTANILLA'); -- id_legacy 21  <- faltaba (doble espacio + " - ")

-- Nombres normalizados de las categorías que existen hoy. Se materializa para
-- que la expresión de normalización esté escrita UNA sola vez y el UPDATE y el
-- guard no puedan divergir — que es cómo nació este bug.
DROP TABLE IF EXISTS tmp_padron_cat_norm;
CREATE TEMP TABLE tmp_padron_cat_norm AS
SELECT cs.id,
       cs.nombre,
       upper(btrim(
         regexp_replace(
           regexp_replace(replace(cs.nombre, chr(160), ' '), '\s+', ' ', 'g'),
           '\s*-\s*', '-', 'g')
       )) AS nombre_norm
  FROM categorias_sociales cs;


-- ------------------------------------------------------------
-- 2. Marcar las que falten
--
-- El `AND NOT cs.habilita_voto` es lo que hace la migración idempotente: en
-- una segunda corrida no toca ninguna fila. Y nunca pone false: no revierte
-- una categoría que un administrador haya habilitado desde el CRUD.
-- ------------------------------------------------------------
UPDATE categorias_sociales cs
   SET habilita_voto = true
  FROM tmp_padron_cat_norm n
 WHERE n.id = cs.id
   AND NOT cs.habilita_voto
   AND EXISTS (
         SELECT 1 FROM tmp_padron_esperadas e
          WHERE e.id_legacy = n.id
             OR e.nombre_norm = n.nombre_norm
       );


-- ------------------------------------------------------------
-- 3. Guard endurecido: cobertura exacta de las 8, con los nombres que faltan
--
-- Se cuentan slots CUBIERTOS (8 identidades), no filas con la bandera. La
-- diferencia importa en las dos direcciones:
--  · 6 de 8 ahora falla, que es lo que el guard viejo dejaba pasar;
--  · una novena categoría habilitada a mano desde el CRUD NO hace fallar el
--    deploy — el club puede sumar categorías, y abortar una migración por eso
--    sería un falso positivo. Se reporta como NOTICE.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cubiertas integer;
  v_faltan    text;
  v_extra     text;
BEGIN
  WITH cobertura AS (
    SELECT e.slot, bool_or(cs.habilita_voto) AS cubierto
      FROM tmp_padron_esperadas e
      LEFT JOIN tmp_padron_cat_norm n
             ON n.id = e.id_legacy OR n.nombre_norm = e.nombre_norm
      LEFT JOIN categorias_sociales cs ON cs.id = n.id
     GROUP BY e.slot
  )
  SELECT count(*) FILTER (WHERE cubierto),
         string_agg('[' || slot || ']', ', ' ORDER BY slot) FILTER (WHERE cubierto IS NOT TRUE)
    INTO v_cubiertas, v_faltan
    FROM cobertura;

  -- Base todavía sin catálogos: no hay nada que sembrar y no hay nada roto.
  -- El flujo documentado en CLAUDE.md ("Recrear una base desde cero") corre
  -- `supabase db push` ANTES de los seeds, así que acá categorias_sociales
  -- está vacía. Abortar convertiría el push en un error fatal en toda base
  -- nueva. El guard sólo tiene sentido cuando hay catálogo que verificar: si
  -- después se siembra y falta alguna, lo detecta el reseed de la migración
  -- (migration/reseed_post_migracion.sql) o el preflight.
  IF NOT EXISTS (SELECT 1 FROM categorias_sociales) THEN
    RAISE NOTICE 'categorias_sociales está vacía (base nueva, sin seed todavía): no hay nada que sembrar. Saltando.';
    RETURN;
  END IF;

  IF v_cubiertas <> 8 THEN
    -- Los nombres van entre corchetes a propósito: hace visible el espacio de
    -- más que causó este bug.
    RAISE EXCEPTION
      'padrón electoral: se esperaban 8 categorías con habilita_voto=true y quedaron %. Faltan: %',
      v_cubiertas, coalesce(v_faltan, '(ninguna)')
      USING HINT = 'Cada categoría se busca por su id determinista o por su nombre normalizado '
                   '(mayúsculas, espacios colapsados, sin espacios alrededor del guion). '
                   'Si el club renombró o dio de baja alguna, actualizar tmp_padron_esperadas en esta migración.';
  END IF;

  SELECT string_agg('[' || cs.nombre || ']', ', ' ORDER BY cs.nombre)
    INTO v_extra
    FROM categorias_sociales cs
   WHERE cs.habilita_voto
     AND NOT EXISTS (
           SELECT 1 FROM tmp_padron_esperadas e
             JOIN tmp_padron_cat_norm n
               ON n.id = e.id_legacy OR n.nombre_norm = e.nombre_norm
            WHERE n.id = cs.id
         );

  IF v_extra IS NOT NULL THEN
    RAISE NOTICE 'padrón electoral: además de las 8 esperadas hay categorías habilitadas a votar desde el CRUD: %', v_extra;
  END IF;

  RAISE NOTICE 'padrón electoral: 8/8 categorías esperadas con habilita_voto=true.';
END $$;


-- ------------------------------------------------------------
-- 4. tipos_cuotas.afecta_padron — el seed matchea, el guard no servía
--
-- Revisado: los tipos migrados del legacy son 'Cuota Social' (id_legacy 1),
-- 'Cuota Adherente' (3) y 'Cuota Escuela' (4). El seed original buscaba
-- upper(btrim(nombre)) = 'CUOTA SOCIAL' y matchea bien: acá NO hay datos que
-- arreglar (verificado sobre una copia de producción: 'Cuota Social' quedó en
-- true, las otras dos en false).
--
-- Lo que sí tiene el mismo defecto de forma es el guard:
--     IF (SELECT count(*) FROM tipos_cuotas WHERE afecta_padron) = 0 ...
-- cuenta CUALQUIER tipo marcado. Si 'Cuota Social' no hubiera matcheado pero
-- alguien tenía 'Cuota Escuela' marcada desde el CRUD, el count daba 1 y el
-- guard aprobaba un padrón donde el criterio "al día" mira el tipo de cuota
-- equivocado. Se reafirma el marcado (no-op hoy, con el mismo criterio
-- id OR nombre normalizado) y se verifica el tipo ESPECÍFICO.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_padron_tipos_norm;
CREATE TEMP TABLE tmp_padron_tipos_norm AS
SELECT tc.id,
       tc.nombre,
       upper(btrim(regexp_replace(replace(tc.nombre, chr(160), ' '), '\s+', ' ', 'g'))) AS nombre_norm
  FROM tipos_cuotas tc;

UPDATE tipos_cuotas tc
   SET afecta_padron = true
  FROM tmp_padron_tipos_norm n
 WHERE n.id = tc.id
   AND NOT tc.afecta_padron
   AND (n.id = '5139448f-57ff-5234-bf30-ddfefd0f3ab8'::uuid   -- uuid5 de tipos_cuotas:1
        OR n.nombre_norm = 'CUOTA SOCIAL');

DO $$
DECLARE v_marcados text;
BEGIN
  -- Mismo caso que el guard de categorias_sociales: en una base recién creada
  -- por `supabase db push` los catálogos todavía no existen. Sin catálogo no
  -- hay nada que verificar, y abortar rompería toda instalación nueva.
  IF NOT EXISTS (SELECT 1 FROM tipos_cuotas) THEN
    RAISE NOTICE 'tipos_cuotas está vacía (base nueva, sin seed todavía): no hay nada que verificar. Saltando.';
    RETURN;
  END IF;

  SELECT string_agg('[' || tc.nombre || ']', ', ' ORDER BY tc.nombre)
    INTO v_marcados
    FROM tipos_cuotas tc
    JOIN tmp_padron_tipos_norm n ON n.id = tc.id
   WHERE tc.afecta_padron
     AND (n.id = '5139448f-57ff-5234-bf30-ddfefd0f3ab8'::uuid
          OR n.nombre_norm = 'CUOTA SOCIAL');

  IF v_marcados IS NULL THEN
    RAISE EXCEPTION 'padrón electoral: la cuota social no quedó marcada con afecta_padron=true'
      USING HINT = 'Sin ella el criterio "al día" desaparece y el padrón habilita a todo moroso. '
                   'Se busca por id determinista (uuid5 de tipos_cuotas:1) o por nombre normalizado = CUOTA SOCIAL.';
  END IF;

  RAISE NOTICE 'padrón electoral: afecta_padron confirmado en %', v_marcados;
END $$;


-- ------------------------------------------------------------
-- 5. Limpieza
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_padron_esperadas;
DROP TABLE IF EXISTS tmp_padron_cat_norm;
DROP TABLE IF EXISTS tmp_padron_tipos_norm;
