"use client";

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
}

export const SIDEBAR_WIDTH = { expanded: 256, rail: 56 } as const;

/**
 * Collapsible sidebar. Width animates between the 256px expanded layout and
 * the 56px icon rail; content swaps once the state flips.
 */
export function AppSidebar({ variant, collapsed, onToggle, railActive, className }: AppSidebarProps) {
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed}
      style={{ width: collapsed ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.expanded }}
      className={cn(
        "relative h-full shrink-0 overflow-hidden bg-sidebar text-sidebar-fg transition-[width] duration-200 ease-out",
        className,
      )}
    >
      {collapsed ? (
        <SidebarRail activeKeys={railActive} onToggle={onToggle} />
      ) : variant === "space" ? (
        <SpaceSidebar onToggle={onToggle} />
      ) : (
        <WorkspaceSidebar onToggle={onToggle} />
      )}
    </aside>
  );
}
