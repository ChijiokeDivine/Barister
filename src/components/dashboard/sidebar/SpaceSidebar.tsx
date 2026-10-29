"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LuBookOpen,
  LuBot,
  LuChevronsUpDown,
  LuEllipsis,
  LuFolder,
  LuLayers,
  LuPanelLeft,
  LuPlus,
  LuSearch,
  LuX,
} from "react-icons/lu";
import { IconButton } from "../ui/IconButton";
import { Wordmark } from "../ui/Brand";
import type { RecentThread, Space } from "../types";
import { SidebarNavItem, SidebarSectionLabel, SpaceSwatch, ThreadRow } from "./primitives";

interface Props {
  spaces: Space[];
  recents: RecentThread[];
  activeSpaceName: string;
  caseId: string;
  onToggle: () => void;
}

/** Expanded sidebar used inside a space: nav, space switcher, coloured recents. */
export function SpaceSidebar({ spaces, recents, activeSpaceName, caseId, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-3">
        <Link href="/dashboard" aria-label="Home" className="rounded outline-none focus-visible:ring-2 focus-visible:ring-white/25">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
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
        <SidebarNavItem icon={<LuPlus />} label="New" href={`/chat?matter=${caseId}`} />
        <SidebarNavItem icon={<LuBot />} label="Agents" href="/agents" active={pathname.startsWith("/agents")} />
        <SidebarNavItem icon={<LuFolder />} label="Vault" href={`/vault?caseId=${caseId}`} active={pathname.startsWith("/vault")} />
        <SidebarNavItem icon={<LuLayers />} label="Workflows" href="/workflows" active={pathname.startsWith("/workflows")} />
        <SidebarNavItem icon={<LuBookOpen />} label="Library" href="/outputs" active={pathname.startsWith("/outputs")} />
        <SidebarNavItem icon={<LuEllipsis />} label="More" href="/settings" active={pathname.startsWith("/settings")} />

        <SidebarSectionLabel className="pt-6 text-center text-[12px] font-medium text-sidebar-fg/80">
          Spaces
        </SidebarSectionLabel>
        {spaces.map((s) => (
          <SidebarNavItem key={s.id} icon={<SpaceSwatch color={s.color} />} label={s.name} href={s.href} active={pathname === s.href} />
        ))}

        {recents.length > 0 && (
          <>
            <SidebarSectionLabel className="pt-6">Recents</SidebarSectionLabel>
            {recents.map((t) => (
              <ThreadRow key={t.id} thread={t} colored />
            ))}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-sidebar-line p-3">
        <Link
          href="/cases"
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-sidebar-fg outline-none transition-colors hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <LuChevronsUpDown aria-hidden className="size-4 text-sidebar-muted" />
          <span className="truncate">{activeSpaceName}</span>
        </Link>
      </div>
    </div>
  );
}
