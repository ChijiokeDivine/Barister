"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "react-icons/lu";
import { IconButton } from "../ui/IconButton";
import { Wordmark } from "../ui/Brand";
import { pinned, recents, spaces } from "../data/mock";
import { currentUser } from "../data/mock";
import { SidebarNavItem, SidebarSectionLabel, SpaceSwatch, ThreadRow } from "./primitives";

interface Props {
  onToggle: () => void;
}

/** Expanded sidebar for the home screen: threads, apps, pinned and spaces. */
export function WorkspaceSidebar({ onToggle }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-3">
        <Link href="/dashboard" aria-label="Home" className="outline-none focus-visible:ring-2 focus-visible:ring-white/25 rounded">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <span className="relative">
            <IconButton label="Notifications" tone="dark" size="sm">
              <LuBell />
            </IconButton>
            <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500 ring-2 ring-sidebar" />
          </span>
          <IconButton label="Search" tone="dark" size="sm">
            <LuSearch />
          </IconButton>
          <IconButton label="Collapse sidebar" tone="dark" size="sm" onClick={onToggle}>
            <LuPanelLeft />
          </IconButton>
        </div>
      </div>

      <nav aria-label="Primary" className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <SidebarNavItem boxedIcon icon={<LuPlus />} label="New Thread" href="/dashboard" active={pathname === "/dashboard"} />
        <SidebarNavItem icon={<LuBot />} label="Agents" href="/agents" active={pathname.startsWith("/agents")} />
        <SidebarNavItem icon={<LuFolder />} label="Vaults" href="/vault" active={pathname.startsWith("/vault")} />
        <SidebarNavItem icon={<LuEllipsis />} label="More" />

        <SidebarSectionLabel>Apps</SidebarSectionLabel>
        <SidebarNavItem icon={<LuLayers />} label="Contract Intelligence" href="/workflows" />

        <SidebarSectionLabel>Recents</SidebarSectionLabel>
        {recents.slice(0, 3).map((t) => (
          <ThreadRow key={t.id} thread={t} />
        ))}
        <SidebarNavItem icon={<LuClock />} label="View History" className="mt-0.5" />

        <SidebarSectionLabel>Pinned</SidebarSectionLabel>
        {pinned.map((t) => (
          <ThreadRow key={t.id} thread={t} />
        ))}

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
        <SidebarNavItem icon={<LuBriefcase />} label="View Spaces" href="/cases" />
      </nav>

      <div className="shrink-0 border-t border-sidebar-line p-3">
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-sidebar-fg outline-none transition-colors hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <span
            aria-hidden
            className="inline-flex size-5 items-center justify-center rounded-[5px] bg-sidebar-active text-[11px] font-medium"
          >
            {currentUser.initial}
          </span>
          <span className="truncate">{currentUser.name}</span>
        </button>
      </div>
    </div>
  );
}
