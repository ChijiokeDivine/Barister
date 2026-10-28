import Link from "next/link";
import type { ReactNode } from "react";
import { LuArrowUpRight } from "react-icons/lu";
import { cn } from "@/lib/cn";

interface PanelProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Bordered content block used across the workspace pages. */
export function Panel({ title, description, action, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-line bg-canvas", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-serif text-[17px] leading-tight text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface/60 px-3.5 py-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p className="mt-1 font-serif text-[22px] leading-none text-fg">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-fg-muted">{hint}</p>}
    </div>
  );
}

interface DataRowProps {
  href?: string;
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** One line in a list: title + meta on the left, status/action on the right. */
export function DataRow({ href, title, meta, right, icon, className }: DataRowProps) {
  const content = (
    <>
      {icon && <span className="mt-0.5 shrink-0 text-[15px] text-fg-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-fg">{title}</span>
        {meta && <span className="mt-0.5 block text-[12px] leading-5 text-fg-muted">{meta}</span>}
      </span>
      {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
      {href && <LuArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />}
    </>
  );

  const classes = cn(
    "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
    href && "outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("-mx-2 divide-y divide-line/70", className)}>{children}</ul>;
}

export function RowItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}
