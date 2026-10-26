"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tabs, type TabItem } from "../ui/Tabs";

interface PageHeaderProps {
  title: string;
  /** Colour swatch before the title. */
  swatchClassName?: string;
  tabs: TabItem[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
  /** Right-aligned action (e.g. Add members). */
  action?: ReactNode;
  className?: string;
}

/** Tinted space header: swatch + serif title, action button, tab row. */
export function PageHeader({
  title,
  swatchClassName = "bg-tile-teal",
  tabs,
  defaultTab,
  onTabChange,
  action,
  className,
}: PageHeaderProps) {
  const [tab, setTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <header className={cn("relative shrink-0 bg-sage px-10 pb-3 pt-7", className)}>
      <div className="mx-auto flex w-full max-w-[1120px] items-start justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden className={cn("size-4 shrink-0 rounded-[4px]", swatchClassName)} />
          <h1 className="font-serif text-[26px] leading-none tracking-[-0.01em] text-fg">{title}</h1>
        </div>
        {action}
      </div>
      <Tabs
        label={`${title} sections`}
        items={tabs}
        value={tab}
        onValueChange={(id) => {
          setTab(id);
          onTabChange?.(id);
        }}
        className="mx-auto mt-9 w-full max-w-[1120px]"
      />
    </header>
  );
}

export function HeaderButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-white px-3.5 py-2 text-[13px] font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)] outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {children}
    </button>
  );
}
