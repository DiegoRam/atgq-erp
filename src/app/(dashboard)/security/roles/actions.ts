"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { MODULOS } from "@/types/security";
import type { RoleWithCount, PermisoModulo } from "@/types/security";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) throw new Error("No autorizado — requiere rol Administrador");
  return user;
}

const PROTECTED_ROLES = ["Administrador", "Tesorero", "Recepcionista", "Solo Lectura"];

export async function getRolesWithCount(): Promise<RoleWithCount[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: roles, error } = await admin
    .from("roles")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);

  // Get user counts per role
  const { data: userRoles } = await admin
    .from("usuarios_roles")
    .select("rol_id");

  const countMap = new Map<string, number>();
  for (const ur of userRoles ?? []) {
    countMap.set(ur.rol_id, (countMap.get(ur.rol_id) ?? 0) + 1);
  }

  return (roles ?? []).map((r) => ({
    ...r,
    usuarios_count: countMap.get(r.id) ?? 0,
  }));
}

export async function createRole(data: {
  nombre: string;
  descripcion?: string | null;
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: role, error } = await admin
    .from("roles")
    .insert({
      nombre: data.nombre,
      descripcion: data.descripcion || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un rol con ese nombre");
    }
    throw new Error(error.message);
  }

  // Create default permisos (all false) for all modules
  const permisos = MODULOS.map((modulo) => ({
    rol_id: role.id,
    modulo,
    puede_leer: false,
    puede_escribir: false,
    puede_eliminar: false,
  }));

  const { error: permError } = await admin
    .from("permisos_modulo")
    .insert(permisos);
  if (permError) throw new Error(permError.message);

  revalidatePath("/security/roles");
}

export async function updateRole(
  id: string,
  data: { nombre: string; descripcion?: string | null },
) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("roles")
    .update({
      nombre: data.nombre,
      descripcion: data.descripcion || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un rol con ese nombre");
    }
    throw new Error(error.message);
  }

  revalidatePath("/security/roles");
}

export async function deleteRole(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Check if it's a protected role
  const { data: role } = await admin
    .from("roles")
    .select("nombre")
    .eq("id", id)
    .single();

  if (role && PROTECTED_ROLES.includes(role.nombre)) {
    throw new Error("No se pueden eliminar los roles base del sistema");
  }

  // Check if role has users
  const { count } = await admin
    .from("usuarios_roles")
    .select("*", { count: "exact", head: true })
    .eq("rol_id", id);

  if (count && count > 0) {
    throw new Error("No se puede eliminar un rol con usuarios asignados");
  }

  const { error } = await admin.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/security/roles");
}

export async function getRolePermisos(rolId: string): Promise<PermisoModulo[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("permisos_modulo")
    .select("*")
    .eq("rol_id", rolId)
    .order("modulo");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateRolePermisos(
  rolId: string,
  permisos: {
    modulo: string;
    puede_leer: boolean;
    puede_escribir: boolean;
    puede_eliminar: boolean;
  }[],
) {
  await requireAdmin();
  const admin = createAdminClient();

  // Upsert all permissions in one go
  const rows = permisos.map((p) => ({
    rol_id: rolId,
    modulo: p.modulo,
    puede_leer: p.puede_leer,
    puede_escribir: p.puede_escribir,
    puede_eliminar: p.puede_eliminar,
  }));

  const { error } = await admin
    .from("permisos_modulo")
    .upsert(rows, { onConflict: "rol_id,modulo" });

  if (error) throw new Error(error.message);
  revalidatePath("/security/roles");
}

export async function getRoleById(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
