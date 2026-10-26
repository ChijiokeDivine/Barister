"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/cn";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Shown when `value` is null. */
  placeholder: string;
  icon?: ReactNode;
  align?: "left" | "right";
  className?: string;
  menuClassName?: string;
  /** Custom trigger content, overrides icon + label + chevron. */
  renderValue?: (selected: DropdownOption | undefined) => ReactNode;
  triggerClassName?: string;
}

/** Compact select: trigger button + popover list with outside-click and Esc to close. */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  icon,
  align = "left",
  className,
  menuClassName,
  renderValue,
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 [&>svg]:shrink-0",
          triggerClassName,
        )}
      >
        {renderValue ? (
          renderValue(selected)
        ) : (
          <>
            {icon}
            <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
            <LuChevronDown aria-hidden className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            "absolute z-40 mt-1.5 max-w-[calc(100vw-1rem)] min-w-52 overflow-hidden rounded-lg border border-line bg-canvas p-1 shadow-pop",
            align === "right" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-surface"
              >
                <span className="min-w-0 truncate">{o.label}</span>
                <span className="flex items-center gap-2 text-fg-subtle">
                  {o.hint && <span className="shrink-0 whitespace-nowrap text-[12px]">{o.hint}</span>}
                  {o.value === value && <LuCheck aria-hidden className="size-3.5 text-accent" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
