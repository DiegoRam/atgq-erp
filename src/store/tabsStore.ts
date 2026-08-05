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
  /** `false` hasta que `hydrate()` corre en el cliente. */
  hydrated: boolean;
  hydrate: () => void;
  openTab: (href: string, label: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
};

function emptyState(): { tabs: Tab[]; activeTabId: string | null } {
  return { tabs: [], activeTabId: null };
}

function isTab(value: unknown): value is Tab {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.label === "string" &&
    typeof t.href === "string"
  );
}

function loadFromSession(): { tabs: Tab[]; activeTabId: string | null } {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    // Se valida la forma en vez de confiar en el JSON: el valor lo puede
    // haber dejado una versión anterior del store o quedar corrupto, y como
    // vive en sessionStorage un `JSON.parse` que devuelve `null` rompería la
    // app en cada render hasta que el usuario cierre la pestaña (no hay
    // error.tsx que lo contenga, y recargar no lo limpia).
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();

    const { tabs, activeTabId } = parsed as Record<string, unknown>;
    if (!Array.isArray(tabs)) return emptyState();

    return {
      tabs: tabs.filter(isTab),
      activeTabId: typeof activeTabId === "string" ? activeTabId : null,
    };
  } catch {
    return emptyState();
  }
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
  // El estado inicial arranca vacío a propósito, y NO desde `sessionStorage`:
  // leerlo acá hace que el primer render del cliente ya difiera del HTML del
  // servidor (que nunca tiene tabs) y React tira un error de hidratación.
  // La carga real ocurre en `hydrate()`, después de montar.
  return {
    tabs: [],
    activeTabId: null,
    hydrated: false,

    hydrate() {
      if (get().hydrated) return;

      const persisted = loadFromSession();
      const pendientes = get().tabs;

      // Se fusiona en vez de elegir uno de los dos: si el usuario alcanzó a
      // abrir un tab antes de que corriera este efecto, `openTab` ya pisó
      // sessionStorage con esa única entrada, así que descartar los
      // persistidos acá perdería la sesión anterior de forma permanente.
      // Los de memoria van al final y ganan en caso de repetirse.
      const merged = [
        ...persisted.tabs.filter((p) => !pendientes.some((t) => t.id === p.id)),
        ...pendientes,
      ].slice(-MAX_TABS);

      const preferido = get().activeTabId ?? persisted.activeTabId;
      const activeTabId = merged.some((t) => t.id === preferido)
        ? preferido
        : (merged[merged.length - 1]?.id ?? null);

      set({ tabs: merged, activeTabId, hydrated: true });
      // Reescribe la sesión ya normalizada (recortada a MAX_TABS y sin
      // entradas inválidas), para que no quede divergiendo del estado.
      saveToSession(merged, activeTabId);
    },

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
