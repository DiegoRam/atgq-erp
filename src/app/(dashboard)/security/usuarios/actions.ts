"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { isAdmin } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { UsuarioSistema } from "@/types/security";
import type { User } from "@supabase/supabase-js";

async function requireAdmin() {
  const supabase = await createClient();
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

  // Se pagina hasta agotar en vez de pedir una sola página de 1000: desde la
  // app móvil, cada socio que activa su cuenta crea un usuario en Auth (hasta
  // ~8.400). Con una sola página, el staff —que son un puñado y se crearon
  // primero— se caía del listado por completo.
  const PER_PAGE = 1000;
  const users: User[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: PER_PAGE,
    });
    if (usersError) throw new Error(usersError.message);
    users.push(...data.users);
    if (data.users.length < PER_PAGE) break;
  }

  // Las cuentas de la app móvil no son usuarios del ERP: no tienen ni pueden
  // tener un rol (lo impide el trigger trg_usuarios_roles_excluye_socios), así
  // que en esta pantalla sólo serían ruido. Se administran desde
  // /socios/app-movil. Se excluyen también las revocadas: siguen siendo cuentas
  // de socios, no de staff.
  // fetchAllRows y no un .select() pelado: PostgREST corta en 1000 filas en
  // silencio, y acá eso reintroduce exactamente el problema que la paginación
  // de arriba acaba de resolver — a partir de la cuenta de socio número 1.001
  // el filtro dejaría de reconocerlas y volverían a aparecer en el listado.
  const cuentasSocios = await fetchAllRows<{ user_id: string }>((desde, hasta) =>
    admin
      .from("socios_usuarios")
      .select("user_id")
      // Sólo los vínculos vivos: una cuenta ya desvinculada dejó de ser de la
      // app móvil, y ocultarla acá la volvería invisible e inadministrable
      // (no habría forma de borrarla desde ninguna pantalla).
      .is("revocado_at", null)
      .order("user_id")
      .range(desde, hasta),
  );
  const esDeSocio = new Set(cuentasSocios.map((c) => c.user_id));

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

  return users
    .filter((u) => !esDeSocio.has(u.id))
    .map((u) => {
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

  if (!data.email || !data.password || data.password.length < 8 || !data.rol_id) {
    throw new Error("Datos inválidos");
  }

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
  const currentUser = await requireAdmin();
  if (userId === currentUser.id) {
    throw new Error("No puede modificar su propio rol");
  }
  const admin = createAdminClient();

  // Delete existing and insert new in sequence
  await admin.from("usuarios_roles").delete().eq("user_id", userId);

  const { error } = await admin.from("usuarios_roles").insert({
    user_id: userId,
    rol_id: rolId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/security/usuarios");
}

export async function toggleUsuarioStatus(userId: string, ban: boolean) {
  const currentUser = await requireAdmin();
  if (userId === currentUser.id) {
    throw new Error("No puede desactivar su propia cuenta");
  }
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
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("id, nombre")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
