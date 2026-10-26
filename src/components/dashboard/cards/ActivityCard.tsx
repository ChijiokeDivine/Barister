import Link from "next/link";
import { LuBot, LuFilePlus2 } from "react-icons/lu";
import { cn } from "@/lib/cn";
import type { ActivityItem } from "../types";

interface ActivityCardProps {
  items: ActivityItem[];
  viewAllHref?: string;
  className?: string;
}

const kindStyles: Record<ActivityItem["kind"], string> = {
  agents: "bg-surface-strong text-fg-muted",
  files: "bg-sky-100 text-sky-600",
};

/** Right-rail activity feed. */
export function ActivityCard({ items, viewAllHref = "/audit-trail", className }: ActivityCardProps) {
  return (
    <section aria-labelledby="activity-title" className={cn("w-full", className)}>
      <header className="flex items-center justify-between">
        <h2 id="activity-title" className="font-serif text-[17px] leading-none text-fg">
          Activity
        </h2>
        <Link
          href={viewAllHref}
          className="rounded text-[13px] text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          View all
        </Link>
      </header>

      <ul className="mt-6 space-y-5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn("mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px]", kindStyles[item.kind])}
            >
              {item.kind === "agents" ? <LuBot /> : <LuFilePlus2 />}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-snug text-fg">{item.text}</p>
              <p className="mt-0.5 text-[12px] text-fg-subtle">{item.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
