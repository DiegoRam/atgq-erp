-- ============================================================
-- ATGQ ERP — Bootstrap: Assign Administrador role to first user
-- Task: P9.1
-- ============================================================
-- If no user-role assignments exist, assign Administrador to the
-- first user in auth.users so they can access the Security module.

DO $$
DECLARE
  v_first_user UUID;
  v_admin_role UUID;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM usuarios_roles;
  IF v_count > 0 THEN
    RAISE NOTICE 'usuarios_roles already populated, skipping bootstrap';
    RETURN;
  END IF;

  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_first_user IS NULL THEN
    RAISE NOTICE 'No auth users found, skipping bootstrap';
    RETURN;
  END IF;

  SELECT id INTO v_admin_role FROM roles WHERE nombre = 'Administrador';
  IF v_admin_role IS NULL THEN
    RAISE NOTICE 'Administrador role not found, skipping bootstrap';
    RETURN;
  END IF;

  INSERT INTO usuarios_roles (user_id, rol_id)
  VALUES (v_first_user, v_admin_role)
  ON CONFLICT (user_id, rol_id) DO NOTHING;

  RAISE NOTICE 'Bootstrapped first user % as Administrador', v_first_user;
END $$;
