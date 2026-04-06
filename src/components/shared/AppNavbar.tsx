"use client";

import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { NAV_MODULES, type NavModule } from "@/lib/nav-config";
import { useTabsStore } from "@/store/tabsStore";
import { useRouter } from "next/navigation";
import type { UserPermissions } from "@/types/security";

/* ── Desktop dropdown (unchanged) ── */
function NavDropdown({ module }: { module: NavModule }) {
  const openTab = useTabsStore((s) => s.openTab);
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:text-white focus:outline-none">
        {module.label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {module.items.map((item, i) =>
          "separator" in item ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={item.href}
              className="cursor-pointer"
              onSelect={() => {
                openTab(item.href, item.label);
                router.push(item.href);
              }}
            >
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Mobile collapsible module ── */
function MobileNavModule({
  module,
  onNavigate,
}: {
  module: NavModule;
  onNavigate: () => void;
}) {
  const openTab = useTabsStore((s) => s.openTab);
  const router = useRouter();

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold hover:bg-slate-100">
        {module.label}
        <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 border-l pl-3">
          {module.items.map((item, i) =>
            "separator" in item ? (
              <div key={`sep-${i}`} className="my-1 border-t" />
            ) : (
              <button
                key={item.href}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                onClick={() => {
                  openTab(item.href, item.label);
                  router.push(item.href);
                  onNavigate();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AppNavbarProps {
  permissions?: UserPermissions[];
}

export function AppNavbar({ permissions }: AppNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleModules = permissions
    ? NAV_MODULES.filter((m) => {
        const perm = permissions.find((p) => p.modulo === m.modulo);
        return perm?.puede_leer;
      })
    : NAV_MODULES;

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 bg-[#1e3a5f] px-2 md:flex">
        {visibleModules.map((module) => (
          <NavDropdown key={module.label} module={module} />
        ))}
      </nav>

      {/* Mobile nav */}
      <nav className="flex items-center bg-[#1e3a5f] px-2 py-1 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader>
              <SheetTitle className="text-left">Menú</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {visibleModules.map((module) => (
                <MobileNavModule
                  key={module.label}
                  module={module}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <span className="ml-2 text-sm font-semibold text-white/80">Menú</span>
      </nav>
    </>
  );
}
