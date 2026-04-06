import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
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
    <header className="flex items-center justify-between bg-slate-800 px-3 py-2 text-white sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Image
          src="/logo.png"
          alt="ATGQ Logo"
          width={32}
          height={32}
          className="h-7 w-7 shrink-0 rounded-full sm:h-8 sm:w-8"
        />
        <div className="min-w-0">
          <h1 className="truncate text-xs font-bold leading-tight sm:text-sm">
            <span className="sm:hidden">ATGQ</span>
            <span className="hidden sm:inline">Asociación de Tiro y Gimnasia de Quilmes</span>
          </h1>
          <p className="hidden text-xs text-slate-300 sm:block">
            Sistema de Socios y Control Administrativo
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="text-right text-xs sm:text-sm">
          <p className="hidden sm:block">Usuario: {user?.email ?? "—"}</p>
          <p className="text-xs text-slate-300">{today}</p>
        </div>
        <form action={logout}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
