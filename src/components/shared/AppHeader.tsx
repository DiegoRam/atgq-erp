import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export async function AppHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = format(new Date(), "dd/MM/yyyy", { locale: es });

  return (
    <header className="flex items-center justify-between bg-slate-800 px-4 py-2 text-white">
      <div>
        <h1 className="text-sm font-bold leading-tight">
          Asociación de Tiro y Gimnasia de Quilmes
        </h1>
        <p className="text-xs text-slate-300">
          Sistema de Socios y Control Administrativo
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p>Usuario: {user?.email ?? "—"}</p>
          <p className="text-xs text-slate-300">{today}</p>
        </div>
        <form action={logout}>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
