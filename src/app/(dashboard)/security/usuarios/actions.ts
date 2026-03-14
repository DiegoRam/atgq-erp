"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { UsuarioSistema } from "@/types/security";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  // Bootstrap: allow if no roles assigned yet
  const admin = createAdminClient();
  const { count } = await admin
    .from("usuarios_roles")
    .select("*", { count: "exact", head: true });

  if (count === 0) return user;

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) throw new Error("No autorizado — requiere rol Administrador");
  return user;
}

export async function getUsuarios(): Promise<UsuarioSistema[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const {
    data: { users },
    error: usersError,
  } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw new Error(usersError.message);

  // Get all user-role assignments
  const { data: userRoles } = await admin
    .from("usuarios_roles")
    .select("user_id, rol_id, roles(nombre)");

  const rolesMap = new Map<
    string,
    { rol_id: string; rol_nombre: string }
  >();
  for (const ur of userRoles ?? []) {
    const rolNombre = (ur as unknown as { roles: { nombre: string } }).roles
      ?.nombre;
    rolesMap.set(ur.user_id, {
      rol_id: ur.rol_id,
      rol_nombre: rolNombre ?? "",
    });
  }

  return users.map((u) => {
    const roleInfo = rolesMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned_until: u.banned_until
        ? typeof u.banned_until === "string"
          ? u.banned_until
          : new Date(u.banned_until).toISOString()
        : null,
      rol_id: roleInfo?.rol_id ?? null,
      rol_nombre: roleInfo?.rol_nombre ?? null,
    };
  });
}

export async function createUsuario(data: {
  email: string;
  password: string;
  rol_id: string;
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const {
    data: { user },
    error,
  } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      throw new Error("Ya existe un usuario con ese email");
    }
    throw new Error(error.message);
  }

  if (!user) throw new Error("Error al crear el usuario");

  // Assign role
  const { error: roleError } = await admin.from("usuarios_roles").insert({
    user_id: user.id,
    rol_id: data.rol_id,
  });

  if (roleError) throw new Error(roleError.message);

  revalidatePath("/security/usuarios");
}

export async function updateUsuarioRole(userId: string, rolId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  // Upsert: delete existing then insert
  await admin.from("usuarios_roles").delete().eq("user_id", userId);

  const { error } = await admin.from("usuarios_roles").insert({
    user_id: userId,
    rol_id: rolId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/security/usuarios");
}

export async function toggleUsuarioStatus(userId: string, ban: boolean) {
  await requireAdmin();
  const admin = createAdminClient();

  if (ban) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h", // ~100 years
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/security/usuarios");
}

export async function getRoles() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("id, nombre")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
