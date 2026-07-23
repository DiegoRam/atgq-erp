-- ============================================================
-- ATGQ ERP — Seed: usuario de desarrollo + rol Administrador
-- Idempotente. Debe correr ANTES de seed.sql (seed.sql inserta
-- movimientos_fondos que requieren un usuario en auth.users).
--
-- Credenciales dev: diego@diegoram.me / 12345678
-- ============================================================
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_admin_role uuid;
BEGIN
  -- 1) Crear el usuario Auth si no existe (email confirmado)
  SELECT id INTO v_uid FROM auth.users WHERE email = 'diego@diegoram.me';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'diego@diegoram.me', extensions.crypt('12345678', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_uid::text,
      json_build_object('sub', v_uid::text, 'email', 'diego@diegoram.me')::jsonb,
      'email', now(), now(), now()
    );
    RAISE NOTICE 'Usuario Auth creado: diego@diegoram.me (%)', v_uid;
  ELSE
    RAISE NOTICE 'Usuario Auth diego@diegoram.me ya existe (%)', v_uid;
  END IF;

  -- 2) Asignar rol Administrador (el rol lo crea la migración seed_admin_role)
  SELECT id INTO v_admin_role FROM roles WHERE nombre = 'Administrador' LIMIT 1;
  IF v_admin_role IS NOT NULL THEN
    INSERT INTO usuarios_roles (user_id, rol_id)
    VALUES (v_uid, v_admin_role)
    ON CONFLICT (user_id, rol_id) DO NOTHING;
    RAISE NOTICE 'Rol Administrador asignado a %', v_uid;
  ELSE
    RAISE NOTICE 'Rol Administrador no encontrado; correr migraciones primero';
  END IF;
END $$;
