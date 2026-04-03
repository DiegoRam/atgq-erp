import { createAdminClient } from "@/lib/supabase/admin";
import type { UserPermissions } from "@/types/security";

export async function getUserPermissions(
  userId: string,
): Promise<UserPermissions[]> {
  const admin = createAdminClient();

  // Step 1: Get user's role(s)
  const { data: userRoles, error: urError } = await admin
    .from("usuarios_roles")
    .select("rol_id")
    .eq("user_id", userId);

  if (urError || !userRoles || userRoles.length === 0) return [];

  const rolIds = userRoles.map((ur) => ur.rol_id);

  // Step 2: Get permissions for those roles
  const { data: permisos, error: pError } = await admin
    .from("permisos_modulo")
    .select("modulo, puede_leer, puede_escribir, puede_eliminar")
    .in("rol_id", rolIds);

  if (pError || !permisos) return [];

  // Merge permissions (most permissive wins across multiple roles)
  const permissionsMap = new Map<string, UserPermissions>();
  for (const p of permisos) {
    const existing = permissionsMap.get(p.modulo);
    if (existing) {
      existing.puede_leer = existing.puede_leer || p.puede_leer;
      existing.puede_escribir = existing.puede_escribir || p.puede_escribir;
      existing.puede_eliminar = existing.puede_eliminar || p.puede_eliminar;
    } else {
      permissionsMap.set(p.modulo, { ...p });
    }
  }

  return Array.from(permissionsMap.values());
}

export async function getUserRoles(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios_roles")
    .select("rol_id, roles(id, nombre)")
    .eq("user_id", userId);

  if (error) return [];
  return data ?? [];
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios_roles")
    .select("roles!inner(nombre)")
    .eq("user_id", userId);

  if (!data) return false;
  return data.some(
    (ur) =>
      (ur as unknown as { roles: { nombre: string } }).roles.nombre ===
      "Administrador",
  );
}

export async function hasPermission(
  userId: string,
  modulo: string,
  permiso: "leer" | "escribir" | "eliminar",
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  const moduloPerm = perms.find((p) => p.modulo === modulo);
  if (!moduloPerm) return false;
  switch (permiso) {
    case "leer":
      return moduloPerm.puede_leer;
    case "escribir":
      return moduloPerm.puede_escribir;
    case "eliminar":
      return moduloPerm.puede_eliminar;
  }
}
