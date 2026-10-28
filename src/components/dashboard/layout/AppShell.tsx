"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { LuBell, LuMenu, LuSearch } from "react-icons/lu";
import { cn } from "@/lib/cn";
import { currentUser } from "@/lib/ui/user";
import type { ShellData } from "../types";
import { AppSidebar, type SidebarVariant } from "../sidebar/AppSidebar";
import type { RailKey } from "../sidebar/SidebarRail";
import { Wordmark } from "../ui/Brand";

interface RouteDefaults {
  variant: SidebarVariant;
  collapsed: boolean;
  railActive: RailKey[];
}

/** Per-route starting layout; a manual toggle overrides it and is remembered. */
function defaultsFor(pathname: string): RouteDefaults {
  if (pathname.startsWith("/cases/")) return { variant: "space", collapsed: false, railActive: ["spaces"] };
  if (pathname.startsWith("/cases")) return { variant: "workspace", collapsed: true, railActive: ["spaces"] };
  if (pathname.startsWith("/chat")) return { variant: "workspace", collapsed: true, railActive: ["recent"] };
  if (pathname.startsWith("/workflows")) return { variant: "workspace", collapsed: true, railActive: ["apps"] };
  if (pathname.startsWith("/agents") || pathname.startsWith("/runs")) return { variant: "workspace", collapsed: true, railActive: ["agents"] };
  if (pathname.startsWith("/vault")) return { variant: "workspace", collapsed: true, railActive: ["vault"] };
  return { variant: "workspace", collapsed: false, railActive: ["new"] };
}

const STORAGE_KEY = "barister.sidebar.collapsed";
const DESKTOP_QUERY = "(min-width: 1024px)";

interface SidebarControllerProps {
  nav: ShellData;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

/**
 * Sidebar state owner. Reading `usePathname` here (instead of in the shell)
 * keeps it isolated behind the Suspense boundary below, so pages with an
 * unknown dynamic param can still prerender their content.
 */
function SidebarController({ nav, mobileOpen, onMobileOpenChange }: SidebarControllerProps) {
  const pathname = usePathname();
  const defaults = defaultsFor(pathname);
  // null = follow the route default, boolean = user's explicit choice.
  const [override, setOverride] = useState<boolean | null>(null);
  // Matches the `lg` breakpoint so Ctrl/Cmd+B toggles the right navigation.
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true" || saved === "false") {
        // Restored after mount so the server and first client render match.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOverride(saved === "true");
      }
    } catch {
      /* storage unavailable: keep route defaults */
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Navigation always dismisses the mobile drawer. Adjusting during render
  // (rather than in an effect) avoids a frame with the drawer still open.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (mobileOpen) onMobileOpenChange(false);
  }

  const collapsed = override ?? defaults.collapsed;

  const toggleCollapsed = useCallback(() => {
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

  const toggleNavigation = useCallback(() => {
    if (isDesktop) toggleCollapsed();
    else onMobileOpenChange(!mobileOpen);
  }, [isDesktop, mobileOpen, onMobileOpenChange, toggleCollapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleNavigation();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleNavigation]);

  const activeCaseId = pathname.startsWith("/cases/") ? pathname.split("/")[2] : undefined;
  const activeSpaceName = activeCaseId ? nav.matters.find((m) => m.id === activeCaseId)?.name : undefined;

  return (
    <AppSidebar
      variant={defaults.variant}
      collapsed={collapsed}
      onToggle={toggleNavigation}
      railActive={defaults.railActive}
      nav={nav}
      activeCaseId={activeCaseId}
      activeSpaceName={activeSpaceName}
      mobileOpen={mobileOpen}
      onNavigate={() => onMobileOpenChange(false)}
    />
  );
}

/** Static placeholder that reserves the desktop sidebar column while the
 *  pathname-dependent sidebar resolves during prerendering. */
function SidebarFallback() {
  return <div aria-hidden className="hidden h-full w-[256px] shrink-0 bg-sidebar lg:block" />;
}

/**
 * Dashboard frame: sidebar + scrolling main area.
 * Below `lg` the sidebar becomes an off-canvas drawer with a compact top bar.
 */
export function AppShell({ nav, children }: { nav: ShellData; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Escape closes the mobile drawer only.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[60] cursor-default bg-black/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <Suspense fallback={<SidebarFallback />}>
        <SidebarController nav={nav} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      </Suspense>

      <main
        id="main"
        className={cn(
          "relative flex min-w-0 flex-1 flex-col overflow-y-auto",
          mobileOpen && "max-lg:overflow-hidden",
        )}
      >
        {/* Compact top bar: mobile / tablet only, so desktop stays untouched. */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur-md lg:hidden">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileOpen(true)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[20px] text-fg-muted outline-none transition-colors hover:bg-surface-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuMenu aria-hidden />
            </button>
            <Link
              href="/dashboard"
              aria-label="Barister home"
              className="min-w-0 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Wordmark className="text-[19px]" />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              href="/search"
              aria-label="Search"
              className="inline-flex size-10 items-center justify-center rounded-lg text-[18px] text-fg-muted outline-none transition-colors hover:bg-surface-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuSearch aria-hidden />
            </Link>
            <Link
              href="/agents"
              aria-label="Notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-lg text-[18px] text-fg-muted outline-none transition-colors hover:bg-surface-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuBell aria-hidden />
              <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500 ring-2 ring-canvas" />
            </Link>
            <Link
              href="/settings"
              aria-label={`${currentUser.name} account`}
              className="ml-1 inline-flex size-7 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-sidebar-fg"
            >
              {currentUser.initial}
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
