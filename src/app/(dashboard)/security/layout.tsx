import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Bootstrap: if no user-role assignments exist, allow access to assign first role
  const admin = createAdminClient();
  const { count } = await admin
    .from("usuarios_roles")
    .select("*", { count: "exact", head: true });

  const isBootstrap = count === 0;

  if (!isBootstrap) {
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) redirect("/");
  }

  return <>{children}</>;
}
