"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuDownload, LuRefreshCw, LuShieldCheck, LuShieldPlus, LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { Button } from "../ui/Button";

interface DocumentActionsProps {
  id: string;
  anchored: boolean;
}

interface Verification {
  integrity: { intact: boolean; expected: string; actual: string };
  chain: { verified: boolean; anchors: { onChain: boolean; reason?: string; explorerUrl?: string }[] };
}

/** Verify, anchor, re-redact and delete actions for one vault document. */
export function DocumentActions({ id, anchored }: DocumentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);

  const run = async (action: string, fn: () => Promise<{ tone: "ok" | "bad"; text: string } | void>) => {
    setBusy(action);
    setMessage(null);
    try {
      const result = await fn();
      if (result) setMessage(result);
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "The action failed." });
    } finally {
      setBusy(null);
    }
  };

  const verify = () =>
    run("verify", async () => {
      const v = await api<Verification>(`/api/documents/${id}/verify`);
      setVerification(v);
      return {
        tone: v.integrity.intact && v.chain.verified ? "ok" : v.integrity.intact ? "bad" : "bad",
        text: v.integrity.intact
          ? v.chain.verified
            ? "Vault bytes match the recorded hash and the proof is confirmed on-chain."
            : "Vault bytes are intact, but no confirmed on-chain proof was found."
          : "Integrity check failed: the stored bytes no longer match the recorded hash.",
      };
    });

  const anchor = () =>
    run("anchor", async () => {
      await api(`/api/documents/${id}/anchor`, { method: "POST" });
      router.refresh();
      return { tone: "ok", text: "Anchor submitted. It may take a moment to confirm." };
    });

  const reredact = () =>
    run("reredact", async () => {
      await api(`/api/documents/${id}/reredact`, { method: "POST" });
      router.refresh();
      return { tone: "ok", text: "Redaction re-applied with the current settings and known terms." };
    });

  const remove = () =>
    run("delete", async () => {
      if (!window.confirm("Delete this document and its encrypted blobs? This cannot be undone.")) return;
      await api(`/api/documents/${id}`, { method: "DELETE" });
      router.push("/vault");
    });

  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" className="w-full" onClick={verify} loading={busy === "verify"}>
        <LuShieldCheck aria-hidden className="size-3.5" /> Verify integrity
      </Button>
      <Button variant="secondary" size="sm" className="w-full" onClick={anchor} loading={busy === "anchor"}>
        <LuShieldPlus aria-hidden className="size-3.5" /> {anchored ? "Re-anchor hash" : "Anchor hash"}
      </Button>
      <Button variant="secondary" size="sm" className="w-full" onClick={reredact} loading={busy === "reredact"}>
        <LuRefreshCw aria-hidden className="size-3.5" /> Re-apply redaction
      </Button>
      <a
        href={`/api/documents/${id}/download`}
        className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface"
      >
        <LuDownload aria-hidden className="size-3.5" /> Download original
      </a>
      <Button variant="danger" size="sm" className="w-full" onClick={remove} loading={busy === "delete"}>
        <LuTrash2 aria-hidden className="size-3.5" /> Delete document
      </Button>

      {message && (
        <p role="status" className={message.tone === "ok" ? "rounded-md bg-emerald-50 px-2.5 py-2 text-[12px] leading-5 text-emerald-800" : "rounded-md bg-red-50 px-2.5 py-2 text-[12px] leading-5 text-red-700"}>
          {message.text}
        </p>
      )}
      {verification && !verification.chain.verified && verification.chain.anchors.length > 0 && (
        <p className="text-[11.5px] leading-5 text-fg-muted">
          {verification.chain.anchors.map((a) => a.reason).filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
