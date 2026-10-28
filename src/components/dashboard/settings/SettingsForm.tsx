"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuPlus, LuSave, LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/client/api";
import type { Settings } from "@/lib/services/settings";
import { ENTITY_TYPES } from "@/lib/redact";
import { Button } from "../ui/Button";
import { Checkbox, Field, Input, Label, Select, Textarea } from "../ui/Field";

const ENTITY_LABELS: Record<(typeof ENTITY_TYPES)[number], string> = {
  NAME: "Names",
  EMAIL: "Emails",
  PHONE: "Phone numbers",
  SSN: "Social security numbers",
  CARD: "Card numbers",
  AMOUNT: "Amounts",
  DATE: "Dates",
  ADDRESS: "Addresses",
  IP: "IP addresses",
  URL: "URLs",
  CUSTOM: "Custom patterns",
};

const DATE_MODES = [
  { value: "shift", label: "Shift consistently per matter" },
  { value: "mask", label: "Replace with [DATE_x] tokens" },
  { value: "keep", label: "Leave dates unchanged" },
] as const;

type Pattern = Settings["redaction"]["customPatterns"][number];
type Rule = Settings["playbook"][number];

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const redaction = settings.redaction;

  const patchRedaction = (patch: Partial<Settings["redaction"]>) =>
    setSettings((s) => ({ ...s, redaction: { ...s.redaction, ...patch } }));

  const toggleType = (type: (typeof ENTITY_TYPES)[number], on: boolean) =>
    patchRedaction({ enabled: { ...redaction.enabled, [type]: on } });

  const patchPattern = (index: number, patch: Partial<Pattern>) =>
    patchRedaction({ customPatterns: redaction.customPatterns.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const patchRule = (index: number, patch: Partial<Rule>) =>
    setSettings((s) => ({ ...s, playbook: s.playbook.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));

  const save = async () => {
    const emptyRule = settings.playbook.find((r) => !r.clause.trim() || !r.preferred.trim());
    if (emptyRule) {
      setMessage({ tone: "bad", text: "Every playbook rule needs a clause and a preferred position." });
      return;
    }
    const badPattern = redaction.customPatterns.find((p) => !p.label.trim() || !p.pattern.trim());
    if (badPattern) {
      setMessage({ tone: "bad", text: "Every custom pattern needs a label and a regular expression." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const saved = await api<Settings>("/api/settings", { method: "PUT", json: settings });
      setSettings(saved);
      setMessage({ tone: "ok", text: "Settings saved. New redactions and contract reviews will use them." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Could not save settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="rounded-xl border border-line bg-canvas">
        <header className="border-b border-line px-4 py-3">
          <h2 className="font-serif text-[17px] leading-tight text-fg">Redaction</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">
            Applied to documents on upload and whenever you re-apply redaction. Missing categories stay enabled.
          </p>
        </header>
        <div className="space-y-5 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dates" hint="Shifting keeps the order and intervals between dates intact.">
              <Select
                value={redaction.dateMode}
                onChange={(e) => patchRedaction({ dateMode: e.target.value as Settings["redaction"]["dateMode"] })}
              >
                {DATE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end pb-1">
              <Checkbox
                label="Detect names heuristically"
                checked={redaction.detectNames}
                onChange={(e) => patchRedaction({ detectNames: e.target.checked })}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2">Entity categories</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ENTITY_TYPES.map((type) => (
                <Checkbox
                  key={type}
                  label={ENTITY_LABELS[type]}
                  checked={redaction.enabled[type] !== false}
                  onChange={(e) => toggleType(type, e.target.checked)}
                />
              ))}
            </div>
          </div>

          <Field
            label="Allow list"
            hint="One term per line. Case-insensitive. Use this for courts, statutes and the firm's own name."
          >
            <Textarea
              value={redaction.allowList.join("\n")}
              onChange={(e) =>
                patchRedaction({
                  allowList: e.target.value
                    .split("\n")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder={"Superior Court\nSuperior Court of California"}
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <Label>Custom patterns</Label>
                <p className="mt-0.5 text-[12px] text-fg-subtle">Firm-specific identifiers, matter numbers, internal references.</p>
              </div>
              <Button
                size="sm"
                onClick={() => patchRedaction({ customPatterns: [...redaction.customPatterns, { label: "", pattern: "" }] })}
              >
                <LuPlus aria-hidden className="size-3.5" /> Add
              </Button>
            </div>
            {redaction.customPatterns.length ? (
              <div className="space-y-2">
                {redaction.customPatterns.map((p, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface/50 p-2 sm:grid-cols-[130px_minmax(0,1fr)_60px_auto]">
                    <Input value={p.label} onChange={(e) => patchPattern(i, { label: e.target.value })} placeholder="Label" aria-label="Pattern label" />
                    <Input value={p.pattern} onChange={(e) => patchPattern(i, { pattern: e.target.value })} placeholder="\\bMAT-\\d{4}\\b" aria-label="Regular expression" />
                    <Input value={p.flags ?? ""} onChange={(e) => patchPattern(i, { flags: e.target.value })} placeholder="gi" aria-label="Flags" />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove pattern"
                      onClick={() => patchRedaction({ customPatterns: redaction.customPatterns.filter((_, j) => j !== i) })}
                    >
                      <LuTrash2 aria-hidden className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-4 text-[12px] text-fg-muted">No custom patterns.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-canvas">
        <header className="border-b border-line px-4 py-3">
          <h2 className="font-serif text-[17px] leading-tight text-fg">Negotiation playbook</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">
            Fed into contract review after redaction. State your preferred position, the fallback, and the red line for each clause.
          </p>
        </header>
        <div className="space-y-3 p-4">
          {settings.playbook.length ? (
            settings.playbook.map((rule, i) => (
              <div key={rule.id} className="rounded-lg border border-line bg-surface/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Rule {i + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove rule"
                    onClick={() => setSettings((s) => ({ ...s, playbook: s.playbook.filter((_, j) => j !== i) }))}
                  >
                    <LuTrash2 aria-hidden className="size-3.5" /> Remove
                  </Button>
                </div>
                <div className="mt-2 space-y-3">
                  <Field label="Clause">
                    <Input value={rule.clause} onChange={(e) => patchRule(i, { clause: e.target.value })} placeholder="Limitation of liability" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Preferred position">
                      <Textarea value={rule.preferred} onChange={(e) => patchRule(i, { preferred: e.target.value })} placeholder="Mutual cap at fees paid in the preceding 12 months." />
                    </Field>
                    <Field label="Fallback">
                      <Textarea value={rule.fallback ?? ""} onChange={(e) => patchRule(i, { fallback: e.target.value })} placeholder="Cap at 2× fees paid." />
                    </Field>
                  </div>
                  <Field label="Red line" hint="What the firm will not accept.">
                    <Textarea value={rule.redLine ?? ""} onChange={(e) => patchRule(i, { redLine: e.target.value })} placeholder="No uncapped indemnity for third-party claims." />
                  </Field>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-[12px] text-fg-muted">
              No rules yet. Contract review will still flag issues, but without firm-specific positions.
            </p>
          )}
          <Button
            onClick={() =>
              setSettings((s) => ({
                ...s,
                playbook: [...s.playbook, { id: newId("rule"), clause: "", preferred: "" }],
              }))
            }
          >
            <LuPlus aria-hidden className="size-3.5" /> Add rule
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          <LuSave aria-hidden className="size-3.5" /> Save settings
        </Button>
        {message && (
          <p role="status" className={message.tone === "ok" ? "text-[12.5px] text-emerald-700" : "text-[12.5px] text-red-700"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
