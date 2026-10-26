import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RecentThread, SpaceColor } from "../types";

/* ---------- Expanded sidebar primitives ---------- */

interface NavItemProps {
  icon?: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  /** Wraps the icon in a tinted rounded box (used by "New Thread"). */
  boxedIcon?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

const itemBase =
  "group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-sidebar-fg/90 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25 max-lg:h-9";

export function SidebarNavItem({
  icon,
  label,
  href,
  active,
  boxedIcon,
  onClick,
  className,
  children,
}: NavItemProps) {
  const classes = cn(
    itemBase,
    active ? "bg-sidebar-active text-sidebar-fg" : "hover:bg-sidebar-hover",
    className,
  );
  const content = (
    <>
      {icon && (
        <span
          aria-hidden
          className={cn(
            "inline-flex shrink-0 items-center justify-center text-[15px] text-sidebar-muted group-hover:text-sidebar-fg",
            boxedIcon && "size-5 rounded-[5px] bg-sidebar-active text-sidebar-fg",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {children}
    </>
  );

  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

export function SidebarSectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("px-2 pb-1 pt-4 text-[11px] font-medium tracking-[0.01em] text-sidebar-muted", className)}>
      {children}
    </p>
  );
}

const spaceColors: Record<SpaceColor, string> = {
  teal: "bg-space-teal",
  slate: "bg-space-slate",
  violet: "bg-space-violet",
};

export function SpaceSwatch({ color, className }: { color: SpaceColor; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block size-3 shrink-0 rounded-[3px]", spaceColors[color], className)} />
  );
}

const dotColors: Record<NonNullable<RecentThread["dot"]>, string> = {
  violet: "bg-space-violet",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  white: "bg-white",
  dashed: "border border-dashed border-sidebar-muted bg-transparent",
};

export function RecentDot({ tone }: { tone?: RecentThread["dot"] }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-[5px] shrink-0 rounded-full", tone ? dotColors[tone] : "bg-sidebar-muted")}
    />
  );
}

/** One truncated thread row with a leading dot. */
export function ThreadRow({ thread, colored }: { thread: RecentThread; colored?: boolean }) {
  return (
    <Link
      href={thread.href}
      title={thread.title}
      className="flex h-8 items-center gap-3 rounded-md px-2.5 text-[13px] text-sidebar-fg/85 outline-none transition-colors hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-white/25 max-lg:h-9"
    >
      <RecentDot tone={colored ? thread.dot : undefined} />
      <span className="fade-end min-w-0 flex-1 overflow-hidden whitespace-nowrap">{thread.title}</span>
    </Link>
  );
}
