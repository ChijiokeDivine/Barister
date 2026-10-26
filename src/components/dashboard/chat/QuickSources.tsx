"use client";

import { LuBookOpen, LuFolder, LuGlobe, LuPlus, LuScale } from "react-icons/lu";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const icons: Record<string, ReactNode> = {
  vault: <LuFolder />,
  web: <LuGlobe />,
  playbooks: <LuBookOpen />,
  caselaw: <LuScale />,
};

interface QuickSourcesProps {
  sources: ReadonlyArray<{ id: string; label: string }>;
  selected?: string[];
  onToggle?: (id: string) => void;
  className?: string;
}

/** Row of source chips under the composer. */
export function QuickSources({ sources, selected = [], onToggle, className }: QuickSourcesProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {sources.map((s) => {
        const on = selected.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle?.(s.id)}
            className={cn(
              "flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
              on
                ? "border-accent/40 bg-accent/5 text-fg"
                : "border-line bg-surface text-fg-muted hover:bg-surface-strong hover:text-fg",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="text-[14px] text-fg">
                {icons[s.id]}
              </span>
              <span className="truncate">{s.label}</span>
            </span>
            <LuPlus aria-hidden className={cn("size-3 shrink-0 text-fg-subtle transition-transform", on && "rotate-45")} />
          </button>
        );
      })}
    </div>
  );
}
