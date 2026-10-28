"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LuBell,
  LuBriefcase,
  LuClock,
  LuEllipsis,
  LuFolder,
  LuLayers,
  LuPanelLeft,
  LuPlus,
  LuSearch,
  LuBot,
  LuX,
} from "react-icons/lu";
import { IconButton } from "../ui/IconButton";
import { Wordmark } from "../ui/Brand";
import type { RecentThread, Space } from "../types";
import { currentUser } from "@/lib/ui/user";
import { SidebarNavItem, SidebarSectionLabel, SpaceSwatch, ThreadRow } from "./primitives";

interface Props {
  spaces: Space[];
  recents: RecentThread[];
  pinned: RecentThread[];
  onToggle: () => void;
}

/** Expanded sidebar for the home screen: threads, apps, pinned and spaces. */
export function WorkspaceSidebar({ spaces, recents, pinned, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-3">
        <Link href="/dashboard" aria-label="Home" className="outline-none focus-visible:ring-2 focus-visible:ring-white/25 rounded">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <span className="relative">
            <IconButton label="Notifications" tone="dark" size="sm" onClick={() => router.push("/agents")}>
              <LuBell />
            </IconButton>
            <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500 ring-2 ring-sidebar" />
          </span>
          <IconButton label="Search" tone="dark" size="sm" onClick={() => router.push("/search")}>
            <LuSearch />
          </IconButton>
          <span className="lg:hidden">
            <IconButton label="Close navigation" tone="dark" size="sm" onClick={onToggle} className="max-lg:size-8">
              <LuX />
            </IconButton>
          </span>
          <span className="hidden lg:inline-flex">
            <IconButton label="Collapse sidebar" tone="dark" size="sm" onClick={onToggle}>
              <LuPanelLeft />
            </IconButton>
          </span>
        </div>
      </div>

      <nav aria-label="Primary" className="scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        <SidebarNavItem boxedIcon icon={<LuPlus />} label="New Thread" href="/dashboard" active={pathname === "/dashboard"} />
        <SidebarNavItem icon={<LuBot />} label="Agents" href="/agents" active={pathname.startsWith("/agents")} />
        <SidebarNavItem icon={<LuFolder />} label="Vaults" href="/vault" active={pathname.startsWith("/vault")} />
        <SidebarNavItem icon={<LuEllipsis />} label="More" href="/settings" active={pathname.startsWith("/settings")} />

        <SidebarSectionLabel>Apps</SidebarSectionLabel>
        <SidebarNavItem icon={<LuLayers />} label="Contract Intelligence" href="/workflows" active={pathname.startsWith("/workflows")} />

        {recents.length > 0 && (
          <>
            <SidebarSectionLabel>Recents</SidebarSectionLabel>
            {recents.slice(0, 3).map((t) => (
              <ThreadRow key={t.id} thread={t} />
            ))}
            <SidebarNavItem icon={<LuClock />} label="View History" href="/history" active={pathname.startsWith("/history")} className="mt-0.5" />
          </>
        )}

        {pinned.length > 0 && (
          <>
            <SidebarSectionLabel>Pinned</SidebarSectionLabel>
            {pinned.map((t) => (
              <ThreadRow key={t.id} thread={t} />
            ))}
          </>
        )}

        <SidebarSectionLabel>Spaces</SidebarSectionLabel>
        {spaces.map((s) => (
          <SidebarNavItem
            key={s.id}
            icon={<SpaceSwatch color={s.color} />}
            label={s.name}
            href={s.href}
            active={pathname === s.href}
          />
        ))}
        <SidebarNavItem icon={<LuBriefcase />} label="View Spaces" href="/cases" active={pathname.startsWith("/cases")} />
      </nav>

      <div className="shrink-0 border-t border-sidebar-line p-3">
        <Link
          href="/settings"
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-sidebar-fg outline-none transition-colors hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <span
            aria-hidden
            className="inline-flex size-5 items-center justify-center rounded-[5px] bg-sidebar-active text-[11px] font-medium"
          >
            {currentUser.initial}
          </span>
          <span className="truncate">{currentUser.name}</span>
        </Link>
      </div>
    </div>
  );
}
