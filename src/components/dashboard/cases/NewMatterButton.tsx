"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { Button } from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";

/** Creates a matter through the same API external clients use. */
export function NewMatterButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", clientName: "", matterNumber: "", description: "" });

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Give the matter a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("/api/cases", {
        method: "POST",
        json: {
          name: form.name.trim(),
          clientName: form.clientName.trim() || undefined,
          matterNumber: form.matterNumber.trim() || undefined,
          description: form.description.trim(),
        },
      });
      setOpen(false);
      setForm({ name: "", clientName: "", matterNumber: "", description: "" });
      router.push(`/cases/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the matter.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="mt-3">
        <LuPlus aria-hidden className="size-3.5" /> New matter
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="New matter"
        description="Matters keep documents, runs and deliverables isolated. Redaction tokens never cross matters."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              Create matter
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Matter name">
            <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Acme Acquisition" />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Client">
              <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} placeholder="Acme Co" />
            </Field>
            <Field label="Matter number">
              <Input value={form.matterNumber} onChange={(e) => setForm((f) => ({ ...f, matterNumber: e.target.value }))} placeholder="0089-1287" />
            </Field>
          </div>
          <Field label="Description" hint="Optional context for the team.">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          </Field>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
