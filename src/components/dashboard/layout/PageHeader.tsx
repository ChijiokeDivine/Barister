"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tabs, type TabItem } from "../ui/Tabs";

interface PageHeaderProps {
  title: string;
  /** Colour swatch before the title. */
  swatchClassName?: string;
  tabs: TabItem[];
  defaultTab?: string;
  /** Controlled active tab; when set, the component no longer owns the state. */
  activeTab?: string;
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
  activeTab,
  onTabChange,
  action,
  className,
}: PageHeaderProps) {
  const [internalTab, setInternalTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const tab = activeTab ?? internalTab;

  return (
    <header className={cn("relative shrink-0 bg-sage px-4 pb-2 pt-4 sm:px-6 lg:px-10 lg:pb-3 lg:pt-7", className)}>
      <div className="mx-auto flex w-full max-w-[1120px] items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span aria-hidden className={cn("size-4 shrink-0 rounded-[4px]", swatchClassName)} />
          <h1 className="min-w-0 text-balance font-serif text-[20px] leading-tight tracking-[-0.01em] text-fg sm:text-[22px] lg:text-[26px] lg:leading-none">
            {title}
          </h1>
        </div>
        {action}
      </div>
      <Tabs
        label={`${title} sections`}
        items={tabs}
        value={tab}
        onValueChange={(id) => {
          if (activeTab === undefined) setInternalTab(id);
          onTabChange?.(id);
        }}
        className="scrollbar-none mx-auto mt-5 w-full max-w-[1120px] overflow-x-auto pb-0.5 sm:mt-6 lg:mt-9 lg:overflow-visible"
      />
    </header>
  );
}

export function HeaderButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-md bg-white px-2.5 py-1.5 text-[12px] font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)] outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/50 sm:px-3.5 sm:py-2 sm:text-[13px]"
    >
      {children}
    </button>
  );
}

/** Same visual treatment as HeaderButton, but navigates. */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap rounded-md bg-white px-2.5 py-1.5 text-[12px] font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)] outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/50 sm:px-3.5 sm:py-2 sm:text-[13px]"
    >
      {children}
    </Link>
  );
}
