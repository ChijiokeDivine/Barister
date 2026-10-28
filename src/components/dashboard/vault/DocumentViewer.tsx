"use client";

import { useState } from "react";
import { LuChevronDown, LuEye, LuEyeOff } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { Spinner } from "../ui/Button";

interface DocumentViewerProps {
  id: string;
  initialText: string;
  initialTotal: number;
  initialHasMore: boolean;
}

const PAGE = 50_000;

/** Redacted ⇄ original text with cursor paging; large transcripts never load at once. */
export function DocumentViewer({ id, initialText, initialTotal, initialHasMore }: DocumentViewerProps) {
  const [view, setView] = useState<"redacted" | "original">("redacted");
  const [text, setText] = useState(initialText);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initialText.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextView: "redacted" | "original", nextOffset: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api<{ text: string; total: number; offset: number; hasMore: boolean }>(
        `/api/documents/${id}/text?view=${nextView}&offset=${nextOffset}&limit=${PAGE}`,
      );
      setText((prev) => (replace ? page.text : `${prev}${page.text}`));
      setTotal(page.total);
      setOffset(page.offset + page.text.length);
      setHasMore(page.hasMore);
      setView(nextView);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the document text.");
    } finally {
      setLoading(false);
    }
  };

  const switchView = (next: "redacted" | "original") => {
    if (next === view || loading) return;
    void load(next, 0, true);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(["redacted", "original"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              aria-pressed={view === v}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                view === v ? "bg-white text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-fg-muted hover:text-fg",
              )}
            >
              {v === "redacted" ? <LuEyeOff aria-hidden className="size-3.5" /> : <LuEye aria-hidden className="size-3.5" />}
              {v === "redacted" ? "Redacted" : "Original"}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-fg-subtle">
          {total.toLocaleString()} characters · {text.length.toLocaleString()} loaded
        </p>
      </header>

      {error && <p role="alert" className="border-b border-line bg-red-50 px-4 py-2 text-[12px] text-red-700">{error}</p>}

      <pre className="scroll-quiet max-h-[560px] overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-6 text-fg">
        {text || "This document has no extracted text."}
      </pre>

      <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <p className="text-[11.5px] text-fg-subtle">
          {view === "redacted" ? "Exactly what the agents see." : "The decrypted original — handle with care."}
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={() => void load(view, offset, false)}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
          >
            {loading ? <Spinner className="size-3" /> : <LuChevronDown aria-hidden className="size-3.5" />}
            Load more
          </button>
        )}
      </footer>
    </div>
  );
}
