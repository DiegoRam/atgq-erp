"use client";

import { useTabsStore } from "@/store/tabsStore";
import { useRouter, usePathname } from "next/navigation";
import { X, Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const REPORT_KEYWORDS = [
  "grafico",
  "reportes",
  "sumarizad",
  "mapas",
  "cuotas-mensuales",
];

function isReportTab(href: string): boolean {
  return REPORT_KEYWORDS.some((kw) => href.includes(kw));
}

export function WorkspaceTabs() {
  const { tabs, activeTabId, setActive, closeTab } = useTabsStore();
  const router = useRouter();
  const pathname = usePathname();

  // Sync active tab with current URL
  useEffect(() => {
    const match = tabs.find((t) => t.href === pathname);
    if (match && match.id !== activeTabId) {
      setActive(match.id);
    }
  }, [pathname, tabs, activeTabId, setActive]);

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-slate-100 px-2 py-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const Icon = isReportTab(tab.href) ? BarChart3 : Table2;

        return (
          <div
            key={tab.id}
            className={cn(
              "group flex cursor-pointer items-center gap-1.5 rounded-t px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "border border-b-0 bg-white font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-slate-200",
            )}
            onClick={() => {
              setActive(tab.id);
              router.push(tab.href);
            }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[160px] truncate">{tab.label}</span>
            <button
              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-300 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                const { tabs: currentTabs, activeTabId: currentActive } =
                  useTabsStore.getState();
                const idx = currentTabs.findIndex((t) => t.id === tab.id);
                const wasActive = currentActive === tab.id;

                closeTab(tab.id);

                if (wasActive) {
                  const remaining = currentTabs.filter(
                    (t) => t.id !== tab.id,
                  );
                  const prev = currentTabs[idx - 1] ?? currentTabs[idx + 1];
                  if (prev && remaining.length > 0) {
                    router.push(prev.href);
                  } else {
                    router.push("/");
                  }
                }
              }}
              title="Cerrar tab"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
