"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  LuArchive,
  LuBell,
  LuBookOpen,
  LuBot,
  LuClock,
  LuEllipsis,
  LuFolder,
  LuPanelLeftOpen,
  LuPin,
  LuPlus,
  LuSearch,
} from "react-icons/lu";
import { cn } from "@/lib/cn";
import { LogoMark } from "../ui/Brand";
import type { ShellUser } from "@/lib/auth/types";

export type RailKey = "new" | "agents" | "vault" | "more" | "apps" | "spaces" | "pinned" | "recent";

interface RailItemProps {
  icon: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
}

function RailItem({ icon, label, href, active }: RailItemProps) {
  const classes = cn(
    "group flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25",
    active ? "text-sidebar-fg" : "text-sidebar-muted hover:text-sidebar-fg",
  );
  const iconBox = (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-[16px] transition-colors",
        active ? "bg-sidebar-active" : "group-hover:bg-sidebar-hover",
      )}
    >
      {icon}
    </span>
  );
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={classes}>
      {iconBox}
      <span>{label}</span>
    </Link>
  ) : (
    <button type="button" className={classes}>
      {iconBox}
      <span>{label}</span>
    </button>
  );
}

interface Props {
  activeKeys?: RailKey[];
  user: ShellUser;
  onToggle: () => void;
}

/** Collapsed icon rail. The logo turns into an expand button on hover/focus. */
export function SidebarRail({ activeKeys = [], user, onToggle }: Props) {
  const is = (k: RailKey) => activeKeys.includes(k);
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Expand sidebar"
        className="group relative mt-3 mb-2 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      >
        <LogoMark className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
        <LuPanelLeftOpen
          aria-hidden
          className="absolute size-[18px] text-sidebar-fg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>

      <nav aria-label="Primary" className="scroll-quiet flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto px-1.5">
        <RailItem icon={<LuPlus />} label="New" href="/dashboard" active={is("new")} />
        <RailItem icon={<LuBot />} label="Agent" href="/agents" active={is("agents")} />
        <RailItem icon={<LuFolder />} label="Vault" href="/vault" active={is("vault")} />
        <RailItem icon={<LuBookOpen />} label="More" href="/settings" active={is("more")} />

        <hr className="mx-2 my-2 border-sidebar-line" />

        <RailItem icon={<LuEllipsis />} label="Apps" href="/workflows" active={is("apps")} />
        <RailItem icon={<LuArchive />} label="Spaces" href="/cases" active={is("spaces")} />
        <RailItem icon={<LuPin />} label="Pinned" href="/chat" active={is("pinned")} />
        <RailItem icon={<LuClock />} label="Recent" href="/history" active={is("recent")} />
      </nav>

      <div className="flex shrink-0 flex-col items-center gap-1 pb-3 pt-2">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => router.push("/agents")}
          className="inline-flex size-8 items-center justify-center rounded-md text-[16px] text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <LuBell />
        </button>
        <button
          type="button"
          aria-label="Search"
          onClick={() => router.push("/search")}
          className="inline-flex size-8 items-center justify-center rounded-md text-[16px] text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg focus-visible:ring-2 focus-visible:ring-white/25"
        >
          <LuSearch />
        </button>
        <button
          type="button"
          aria-label={`${user.name} account`}
          onClick={() => router.push("/settings")}
          className="mt-1 inline-flex size-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {user.initial}
        </button>
      </div>
    </div>
  );
}
