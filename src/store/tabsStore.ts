"use client";

import { create } from "zustand";

const MAX_TABS = 8;
const STORAGE_KEY = "atgq-erp-tabs";

export type Tab = {
  id: string;
  label: string;
  href: string;
};

type TabsState = {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (href: string, label: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
};

function loadFromSession(): { tabs: Tab[]; activeTabId: string | null } {
  if (typeof window === "undefined") return { tabs: [], activeTabId: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { tabs: [], activeTabId: null };
}

function saveToSession(tabs: Tab[], activeTabId: string | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch {
    // ignore
  }
}

export const useTabsStore = create<TabsState>((set, get) => {
  const initial = loadFromSession();

  return {
    tabs: initial.tabs,
    activeTabId: initial.activeTabId,

    openTab(href: string, label: string) {
      const { tabs } = get();

      // If tab already exists, just activate it
      const existing = tabs.find((t) => t.href === href);
      if (existing) {
        set({ activeTabId: existing.id });
        saveToSession(tabs, existing.id);
        return;
      }

      const id = href;
      const newTab: Tab = { id, label, href };
      let newTabs = [...tabs, newTab];

      // Enforce max tabs — remove oldest
      if (newTabs.length > MAX_TABS) {
        newTabs = newTabs.slice(newTabs.length - MAX_TABS);
      }

      set({ tabs: newTabs, activeTabId: id });
      saveToSession(newTabs, id);
    },

    closeTab(id: string) {
      const { tabs, activeTabId } = get();
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;

      const newTabs = tabs.filter((t) => t.id !== id);
      let newActiveId = activeTabId;

      if (activeTabId === id) {
        // Activate previous tab, or next, or null
        const prevTab = tabs[idx - 1] ?? tabs[idx + 1] ?? null;
        newActiveId = prevTab?.id ?? null;
      }

      set({ tabs: newTabs, activeTabId: newActiveId });
      saveToSession(newTabs, newActiveId);
    },

    setActive(id: string) {
      const { tabs } = get();
      set({ activeTabId: id });
      saveToSession(tabs, id);
    },
  };
});
