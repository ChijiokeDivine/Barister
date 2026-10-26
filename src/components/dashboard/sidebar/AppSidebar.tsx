"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { SidebarRail, type RailKey } from "./SidebarRail";
import { SpaceSidebar } from "./SpaceSidebar";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export type SidebarVariant = "workspace" | "space";

interface AppSidebarProps {
  /** Which expanded layout to show when not collapsed. */
  variant: SidebarVariant;
  collapsed: boolean;
  onToggle: () => void;
  /** Highlighted items in the collapsed rail. */
  railActive?: RailKey[];
  className?: string;
  /** Below `lg`: whether the off-canvas drawer is showing. */
  mobileOpen?: boolean;
  /** Called after a link inside the drawer is followed. */
  onNavigate?: () => void;
}

export const SIDEBAR_WIDTH = { expanded: 256, rail: 56 } as const;

/**
 * Collapsible sidebar. On desktop the width animates between the 256px
 * expanded layout and the 56px icon rail; below `lg` it becomes an
 * off-canvas drawer that always shows the expanded layout.
 */
export function AppSidebar({
  variant,
  collapsed,
  onToggle,
  railActive,
  className,
  mobileOpen = false,
  onNavigate,
}: AppSidebarProps) {
  // Dismiss the drawer when a navigation link is tapped.
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) onNavigate?.();
  };

  return (
    <aside
      id="app-sidebar"
      aria-label="Sidebar"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
      onClick={handleClick}
      className={cn(
        // Mobile: fixed off-canvas drawer.
        "fixed inset-y-0 left-0 z-[70] h-dvh w-[280px] max-w-[85vw] shrink-0 overflow-hidden bg-sidebar text-sidebar-fg shadow-pop transition-[transform,visibility] duration-200 ease-out",
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        // Desktop: static column with the original animated width.
        "lg:visible lg:relative lg:inset-auto lg:z-auto lg:h-full lg:max-w-none lg:translate-x-0 lg:shadow-none lg:transition-[width]",
        collapsed ? "lg:w-[56px]" : "lg:w-[256px]",
        className,
      )}
    >
      {/* Desktop rail. */}
      {collapsed && (
        <div className="hidden h-full w-full lg:block">
          <SidebarRail activeKeys={railActive} onToggle={onToggle} />
        </div>
      )}

      {/* Expanded layout: always on mobile, only when expanded on desktop. */}
      <div className={cn("h-full w-full", collapsed && "lg:hidden")}>
        {variant === "space" ? <SpaceSidebar onToggle={onToggle} /> : <WorkspaceSidebar onToggle={onToggle} />}
      </div>
    </aside>
  );
}
