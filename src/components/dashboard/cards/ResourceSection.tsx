import Link from "next/link";
import { LuFolder, LuMessageSquare } from "react-icons/lu";
import { cn } from "@/lib/cn";
import type { ResourceItem } from "../types";

export function ResourceCard({ item }: { item: ResourceItem }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-[108px] flex-col justify-between rounded-xl bg-surface p-3 outline-none transition-colors hover:bg-surface-strong focus-visible:ring-2 focus-visible:ring-accent/40 sm:min-h-[132px] sm:p-4"
    >
      <span aria-hidden className="inline-flex size-6 items-center justify-center text-[15px] text-fg-muted">
        <LuFolder />
      </span>
      <div>
        <h3 className="truncate text-[13px] font-medium text-fg">{item.title}</h3>
        <p className="mt-1 flex items-center gap-2 text-[12px] text-fg-subtle">
          <span>
            {item.files} {item.units?.files ?? "files"}
          </span>
          <span aria-hidden className="inline-flex items-center gap-1">
            <LuMessageSquare className="size-3" />
            {item.comments}
          </span>
          <span className="sr-only">
            {item.comments} {item.units?.comments ?? "comments"}
          </span>
        </p>
      </div>
    </Link>
  );
}

interface ResourceSectionProps {
  title: string;
  items: ResourceItem[];
  viewAllHref: string;
  className?: string;
}

/** Titled grid of resource cards (vaults, library). */
export function ResourceSection({ title, items, viewAllHref, className }: ResourceSectionProps) {
  const headingId = `${title.toLowerCase().replace(/\s+/g, "-")}-heading`;
  return (
    <section aria-labelledby={headingId} className={cn(className)}>
      <header className="flex items-center justify-between">
        <h2 id={headingId} className="font-serif text-[19px] leading-none text-fg">
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="rounded text-[13px] text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          View all
        </Link>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {items.map((item) => (
          <ResourceCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
