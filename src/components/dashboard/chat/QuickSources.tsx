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
  sources: ReadonlyArray<{ id: string; label: string; available?: boolean; hint?: string }>;
  selected?: string[];
  onToggle?: (id: string) => void;
  className?: string;
}

/** Row of source chips under the composer. Unconfigured sources stay visible but disabled. */
export function QuickSources({ sources, selected = [], onToggle, className }: QuickSourcesProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {sources.map((s) => {
        const on = selected.includes(s.id);
        const available = s.available !== false;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            disabled={!available}
            title={s.hint ?? (!available ? `${s.label} is not configured in this deployment` : undefined)}
            onClick={() => onToggle?.(s.id)}
            className={cn(
              "flex h-10 items-center justify-between gap-2 rounded-lg border px-2.5 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 sm:h-9 sm:px-3 sm:text-[12.5px]",
              on
                ? "border-accent/40 bg-accent/5 text-fg"
                : "border-line bg-surface text-fg-muted hover:bg-surface-strong hover:text-fg",
              !available && "cursor-not-allowed opacity-45 hover:bg-surface hover:text-fg-muted",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="shrink-0 text-[14px] text-fg">
                {icons[s.id]}
              </span>
              <span className="truncate">{s.label}</span>
            </span>
            {available ? (
              <LuPlus aria-hidden className={cn("size-3 shrink-0 text-fg-subtle transition-transform", on && "rotate-45")} />
            ) : (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">Soon</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
