"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserPermissions } from "@/types/security";

export async function getUserPermissions(
  userId: string,
): Promise<UserPermissions[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios_roles")
    .select("rol_id, roles!inner(id), permisos:permisos_modulo!inner(modulo, puede_leer, puede_escribir, puede_eliminar)")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) return [];

  // Flatten permisos from all roles (user should have one role, but handle multiple)
  const permissionsMap = new Map<string, UserPermissions>();
  for (const ur of data) {
    const permisos = (ur as unknown as { permisos: UserPermissions[] }).permisos;
    for (const p of permisos) {
      const existing = permissionsMap.get(p.modulo);
      if (existing) {
        // Merge: most permissive wins
        existing.puede_leer = existing.puede_leer || p.puede_leer;
        existing.puede_escribir = existing.puede_escribir || p.puede_escribir;
        existing.puede_eliminar = existing.puede_eliminar || p.puede_eliminar;
      } else {
        permissionsMap.set(p.modulo, { ...p });
      }
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
    (ur) => (ur as unknown as { roles: { nombre: string } }).roles.nombre === "Administrador",
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
