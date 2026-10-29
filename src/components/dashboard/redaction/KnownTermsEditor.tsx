"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LuPlus, LuSave, LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { ENTITY_LABELS, ENTITY_TYPES, type EntityType } from "@/lib/entity-types";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";

/** Shape the API accepts; mirrors `KnownTermSchema` in the cases service. */
export interface KnownTermValue {
  value: string;
  type?: EntityType;
  aliases?: string[];
}

interface Row {
  id: string;
  value: string;
  type: EntityType;
  /** Comma-separated in the input, split on save. */
  aliases: string;
}

/**
 * Parties and witnesses declared up front. These are masked by exact match (including aliases),
 * which is the highest-precision redaction available — unlike the heuristic name detector.
 */
export function KnownTermsEditor({ caseId, initial }: { caseId: string; initial: KnownTermValue[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((t, i) => ({ id: `t${i}`, value: t.value, type: t.type ?? "NAME", aliases: (t.aliases ?? []).join(", ") })),
  );
  const nextId = useRef(rows.length);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const patchRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    setRows((rs) => [...rs, { id: `t${nextId.current++}`, value: "", type: "NAME", aliases: "" }]);
    setMessage(null);
  };

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const save = async () => {
    const tooShort = rows.find((r) => r.value.trim().length > 0 && r.value.trim().length < 2);
    if (tooShort) {
      setMessage({ tone: "bad", text: "Every term needs at least 2 characters." });
      return;
    }
    const knownTerms = rows
      .map((r) => ({
        value: r.value.trim(),
        type: r.type,
        aliases: r.aliases
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a.length >= 2),
      }))
      .filter((r) => r.value);

    setSaving(true);
    setMessage(null);
    try {
      await api(`/api/cases/${caseId}`, { method: "PATCH", json: { knownTerms } });
      setMessage({ tone: "ok", text: "Saved. New uploads and re-applied redactions in this matter use these terms." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Could not save known terms." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-line bg-surface/50 p-2 sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_auto]">
              <Field label={i === 0 ? "Term" : undefined} className={i === 0 ? undefined : "sm:pt-0"}>
                <Input
                  value={row.value}
                  onChange={(e) => patchRow(row.id, { value: e.target.value })}
                  placeholder="Sarah Johnson"
                  aria-label={`Known term ${i + 1}`}
                />
              </Field>
              <Field label={i === 0 ? "Category" : undefined}>
                <Select value={row.type} onChange={(e) => patchRow(row.id, { type: e.target.value as EntityType })} aria-label={`Category for term ${i + 1}`}>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ENTITY_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={i === 0 ? "Aliases (comma separated)" : undefined}>
                <Input
                  value={row.aliases}
                  onChange={(e) => patchRow(row.id, { aliases: e.target.value })}
                  placeholder="S. Johnson, Sarah J."
                  aria-label={`Aliases for term ${i + 1}`}
                />
              </Field>
              <div className={i === 0 ? "flex items-end pb-0.5" : "flex items-center"}>
                <Button variant="ghost" size="sm" aria-label={`Remove ${row.value || "term"}`} onClick={() => removeRow(row.id)}>
                  <LuTrash2 aria-hidden className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-[12px] text-fg-muted">
          No known terms yet. Add the parties, witnesses and companies that must always be masked.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={addRow}>
          <LuPlus aria-hidden className="size-3.5" /> Add term
        </Button>
        <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
          <LuSave aria-hidden className="size-3.5" /> Save terms
        </Button>
        {message && (
          <p role="status" className={message.tone === "ok" ? "text-[12.5px] text-emerald-700" : "text-[12.5px] text-red-700"}>
            {message.text}
          </p>
        )}
      </div>
      <p className="text-[11.5px] leading-5 text-fg-subtle">
        Exact matches are masked with one stable token per value, so the same party stays consistent across every document in this matter. Existing
        documents keep their current redaction until you re-apply it from the document page.
      </p>
    </div>
  );
}
