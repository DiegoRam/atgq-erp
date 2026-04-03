-- ============================================================
-- ATGQ ERP — Seed Administrador role with full permissions
-- ============================================================

DO $$
DECLARE
  v_admin_role UUID;
  v_first_user UUID;
BEGIN
  -- Create Administrador role
  INSERT INTO roles (nombre, descripcion)
  VALUES ('Administrador', 'Acceso total al sistema')
  ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion
  RETURNING id INTO v_admin_role;

  -- Grant full permissions on all modules
  INSERT INTO permisos_modulo (rol_id, modulo, puede_leer, puede_escribir, puede_eliminar)
  VALUES
    (v_admin_role, 'socios',      true, true, true),
    (v_admin_role, 'actividades', true, true, true),
    (v_admin_role, 'turnos',      true, true, true),
    (v_admin_role, 'ventas',      true, true, true),
    (v_admin_role, 'stock',       true, true, true),
    (v_admin_role, 'tesoreria',   true, true, true),
    (v_admin_role, 'seguridad',   true, true, true)
  ON CONFLICT (rol_id, modulo) DO NOTHING;

  -- If a user already exists in auth.users, assign them the admin role
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    INSERT INTO usuarios_roles (user_id, rol_id)
    VALUES (v_first_user, v_admin_role)
    ON CONFLICT (user_id, rol_id) DO NOTHING;
    RAISE NOTICE 'Assigned Administrador role to user %', v_first_user;
  ELSE
    RAISE NOTICE 'No auth users yet. After creating a user, run: INSERT INTO usuarios_roles (user_id, rol_id) SELECT ''<user-uuid>'', id FROM roles WHERE nombre = ''Administrador'';';
  END IF;
END $$;
