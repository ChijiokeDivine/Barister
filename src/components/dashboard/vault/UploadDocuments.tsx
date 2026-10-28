"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LuUpload } from "react-icons/lu";
import { api, sha256 } from "@/lib/client/api";
import type { Matter } from "../types";
import { Button } from "../ui/Button";
import { Checkbox, Field, Select } from "../ui/Field";
import { Modal } from "../ui/Modal";

interface UploadDocumentsProps {
  matters: Matter[];
  caseId?: string | null;
  maxMb: number;
}

/** Uploads files with a browser-side SHA-256 so the server can detect transit corruption. */
export function UploadDocuments({ matters, caseId, maxMb }: UploadDocumentsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [matterId, setMatterId] = useState(caseId ?? "");
  const [anchor, setAnchor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFiles([]);
    setError(null);
    setProgress("");
  };

  const submit = async () => {
    if (!files.length) {
      setError("Choose at least one file.");
      return;
    }
    const tooBig = files.find((f) => f.size > maxMb * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} exceeds ${maxMb}MB. Split it or raise MAX_UPLOAD_MB.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const form = new FormData();
        form.append("file", file);
        if (matterId) form.append("caseId", matterId);
        form.append("clientHash", await sha256(file));
        if (anchor) form.append("anchor", "true");
        await api("/api/documents", { method: "POST", body: form });
      }
      setOpen(false);
      setFiles([]);
      setProgress("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <LuUpload aria-hidden className="size-3.5" /> Upload
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Upload documents"
        description={`Files are parsed, encrypted, redacted, and stored per matter. Max ${maxMb}MB per file.`}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={busy}>
              Upload {files.length > 1 ? `${files.length} files` : "document"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="Files" hint="PDF, DOCX, TXT or Markdown. Duplicate bytes in the same matter are deduplicated.">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
              className="block w-full cursor-pointer rounded-md border border-line bg-white px-3 py-2 text-[12.5px] text-fg file:mr-3 file:rounded file:border-0 file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-fg"
            />
          </Field>
          {files.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded-md bg-surface px-3 py-2 text-[12px] text-fg-muted">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="truncate py-0.5">
                  {f.name}
                </li>
              ))}
            </ul>
          )}
          <Field label="Matter">
            <Select value={matterId} onChange={(e) => setMatterId(e.target.value)}>
              <option value="">Unassigned</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.number} · {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox label="Anchor the original hash on Sepolia (costs gas)" checked={anchor} onChange={(e) => setAnchor(e.target.checked)} />
          {progress && <p className="text-[12px] text-fg-muted">{progress}</p>}
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
