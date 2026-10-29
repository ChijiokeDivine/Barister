"use client";

import { useState } from "react";
import { LuEraser, LuScanText } from "react-icons/lu";
import { api } from "@/lib/client/api";
import type { EntityType } from "@/lib/entity-types";
import { Button } from "../ui/Button";
import { Field, Textarea } from "../ui/Field";

interface PreviewResult {
  redacted: string;
  restored: string;
  stats: Partial<Record<EntityType, number>>;
}

const SAMPLE =
  "On March 3, 2021, Sarah Johnson emailed john.smith@acme.com from 123 Main Street about the $12,500 invoice. " +
  "She called (415) 555-0132 the next day and confirmed the meeting with Acme Corp.";

/**
 * Runs the real redactor over pasted text without storing anything. Tokens are per-matter keyed hashes,
 * so what you see here is exactly what an upload would produce (and what the agents would receive).
 */
export function RedactionPreview({ caseId }: { caseId?: string | null }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [showRestored, setShowRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<PreviewResult>("/api/vault/preview", { method: "POST", json: { text, caseId: caseId ?? null } });
      setResult(r);
      setShowRestored(false);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not preview redaction.");
    } finally {
      setBusy(false);
    }
  };

  const counts = result ? Object.entries(result.stats).filter(([, n]) => (n ?? 0) > 0) : [];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Sample text" hint="Nothing is stored. Use a real excerpt only after you trust the rules.">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE}
            className="min-h-40 font-mono text-[12px] leading-5"
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-fg-muted">{showRestored && result ? "Restored (what a deliverable would show)" : "Redacted (what the agents see)"}</p>
          <pre className="min-h-40 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface/60 p-3 font-mono text-[12px] leading-5 text-fg">
            {result ? (showRestored ? result.restored : result.redacted) : "Preview output appears here."}
          </pre>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" loading={busy} disabled={!text.trim()} onClick={() => void run()}>
          <LuScanText aria-hidden className="size-3.5" /> Preview redaction
        </Button>
        {result && (
          <Button size="sm" onClick={() => setShowRestored((v) => !v)}>
            {showRestored ? "Show redacted" : "Show restored"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setText("");
            setResult(null);
            setError(null);
          }}
        >
          <LuEraser aria-hidden className="size-3.5" /> Clear
        </Button>
        {error && <p className="text-[12.5px] text-red-700">{error}</p>}
      </div>

      {result &&
        (counts.length ? (
          <div className="flex flex-wrap gap-1.5">
            {counts.map(([type, n]) => (
              <span key={type} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                {type} × {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-amber-700">No PII detected. Check the categories enabled in Settings, or add the party as a known term.</p>
        ))}
    </div>
  );
}
