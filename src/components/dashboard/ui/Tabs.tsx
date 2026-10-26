"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Accessible name for the tablist. */
  label: string;
  className?: string;
}

/** Text tabs with roving focus (←/→/Home/End) and aria-selected states. */
export function Tabs({ items, value, onValueChange, label, className }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((i) => i.id === value);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onValueChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("flex items-center gap-5", className)}>
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "relative py-1 text-[13px] outline-none transition-colors focus-visible:text-fg",
              active ? "font-medium text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
