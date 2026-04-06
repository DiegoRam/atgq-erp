import { AppHeader } from "@/components/shared/AppHeader";
import { AppNavbar } from "@/components/shared/AppNavbar";
import { WorkspaceTabs } from "@/components/shared/WorkspaceTabs";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let permissions = undefined;
  let hasNoRole = false;

  if (user) {
    // Check if any user-role assignments exist (bootstrap mode)
    const admin = createAdminClient();
    const { count } = await admin
      .from("usuarios_roles")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      const perms = await getUserPermissions(user.id);
      if (perms.length === 0) {
        hasNoRole = true;
      } else {
        permissions = perms;
      }
    }
    // If count === 0, bootstrap mode: show all modules
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <AppNavbar permissions={permissions} />
      <WorkspaceTabs />
      <main className="flex-1 bg-muted/30 p-2 sm:p-4">
        {hasNoRole ? (
          <div className="flex items-center justify-center py-20">
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-center">
              <h2 className="text-lg font-semibold text-yellow-800">
                Sin rol asignado
              </h2>
              <p className="mt-2 text-sm text-yellow-700">
                Su cuenta no tiene rol asignado. Contacte al administrador.
              </p>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
