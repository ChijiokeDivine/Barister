"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppSidebar, type SidebarVariant } from "../sidebar/AppSidebar";
import type { RailKey } from "../sidebar/SidebarRail";

interface RouteDefaults {
  variant: SidebarVariant;
  collapsed: boolean;
  railActive: RailKey[];
}

/** Per-route starting layout; a manual toggle overrides it and is remembered. */
function defaultsFor(pathname: string): RouteDefaults {
  if (pathname.startsWith("/cases/")) return { variant: "space", collapsed: false, railActive: ["spaces"] };
  if (pathname.startsWith("/cases")) return { variant: "workspace", collapsed: true, railActive: ["spaces"] };
  if (pathname.startsWith("/chat")) return { variant: "workspace", collapsed: true, railActive: ["spaces"] };
  return { variant: "workspace", collapsed: false, railActive: ["new"] };
}

const STORAGE_KEY = "barister.sidebar.collapsed";

/**
 * Dashboard frame: sidebar + scrolling main area.
 * Toggle with the sidebar button or Ctrl/Cmd + B.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const defaults = defaultsFor(pathname);
  // null = follow the route default, boolean = user's explicit choice.
  const [override, setOverride] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true" || saved === "false") setOverride(saved === "true");
    } catch {
      /* storage unavailable: keep route defaults */
    }
  }, []);

  const collapsed = override ?? defaults.collapsed;

  const toggle = useCallback(() => {
    setOverride(() => {
      const next = !collapsed;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <AppSidebar variant={defaults.variant} collapsed={collapsed} onToggle={toggle} railActive={defaults.railActive} />
      <main id="main" className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
