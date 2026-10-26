"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { LuSearch } from "react-icons/lu";
import { cn } from "@/lib/cn";
import { MatterTile } from "../ui/MatterTile";
import type { Matter } from "../types";

interface MatterSearchProps {
  matters: Matter[];
  placeholder?: string;
  className?: string;
  /** Called on selection; defaults to navigating to /cases/[id]. */
  onSelect?: (matter: Matter) => void;
}

/**
 * Matter combobox: input with an always-visible result list, live filtering
 * and full keyboard support (↑ ↓ Enter).
 */
export function MatterSearch({
  matters,
  placeholder = "Search client matters or linked spaces",
  className,
  onSelect,
}: MatterSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matters;
    return matters.filter((m) => `${m.number} ${m.name}`.toLowerCase().includes(q));
  }, [matters, query]);

  const active = Math.min(index, Math.max(results.length - 1, 0));

  const choose = (m: Matter) => {
    if (onSelect) onSelect(m);
    else router.push(`/cases/${m.id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((active + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((active - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-canvas shadow-card", className)}>
      <div className="flex h-12 items-center gap-3 px-4">
        <LuSearch aria-hidden className="size-[17px] shrink-0 text-fg" />
        <input
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          aria-label="Search matters"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-muted"
        />
      </div>

      <ul id={listId} role="listbox" className="border-t border-line p-1.5">
        {results.length === 0 && <li className="px-3 py-3 text-[13px] text-fg-subtle">No matters found</li>}
        {results.map((m, i) => (
          <li key={m.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(m)}
              className={cn(
                "grid h-10 w-full grid-cols-[110px_1fr] items-center gap-3 rounded-lg px-3 text-left text-[14px] transition-colors",
                i === active ? "bg-surface" : "bg-transparent",
              )}
            >
              <span className="text-fg">{m.number}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <MatterTile initial={m.initial} tone={m.tone} />
                <span className="truncate text-fg-muted">{m.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
