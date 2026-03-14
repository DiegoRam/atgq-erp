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
import Link from "next/link";

function NavDropdown({ module }: { module: NavModule }) {
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
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} className="cursor-pointer">
                {item.label}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppNavbar() {
  return (
    <nav className="flex items-center gap-1 bg-[#1e3a5f] px-2">
      {NAV_MODULES.map((module) => (
        <NavDropdown key={module.label} module={module} />
      ))}
    </nav>
  );
}
