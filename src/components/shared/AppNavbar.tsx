"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_MODULES, type NavModule } from "@/lib/nav-config";
import { useTabsStore } from "@/store/tabsStore";
import { useRouter } from "next/navigation";
import type { UserPermissions } from "@/types/security";

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

interface AppNavbarProps {
  permissions?: UserPermissions[];
}

export function AppNavbar({ permissions }: AppNavbarProps) {
  const visibleModules = permissions
    ? NAV_MODULES.filter((m) => {
        const perm = permissions.find((p) => p.modulo === m.modulo);
        return perm?.puede_leer;
      })
    : NAV_MODULES;

  return (
    <nav className="flex items-center gap-1 bg-[#1e3a5f] px-2">
      {visibleModules.map((module) => (
        <NavDropdown key={module.label} module={module} />
      ))}
    </nav>
  );
}
