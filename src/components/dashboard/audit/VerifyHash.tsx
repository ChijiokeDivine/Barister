"use client";

import { useRef, useState } from "react";
import { LuFileUp, LuShieldCheck, LuShieldX } from "react-icons/lu";
import { api, sha256 } from "@/lib/client/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";

interface Verification {
  hash: string;
  verified: boolean;
  anchors: { id: string; kind: string; txHash?: string; explorerUrl?: string; onChain: boolean; blockNumber?: number; blockTimestamp?: string; reason?: string }[];
}

/** Independent on-chain check: paste a hash or hash a file locally, then verify against Sepolia. */
export function VerifyHash() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Verification | null>(null);

  const verify = async (value = hash) => {
    const clean = value.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(clean)) {
      setError("Enter a 64-character SHA-256 hex digest.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<Verification>(`/api/audit/verify?hash=${clean}`));
      setHash(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const digest = await sha256(file);
      setHash(digest);
      await verify(digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not hash the file.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="SHA-256" hint="Verification reads the transaction from the chain; it does not trust this app's ledger.">
        <Input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="64 hex characters" className="font-mono text-[12px]" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void verify()} loading={busy}>
          <LuShieldCheck aria-hidden className="size-3.5" /> Verify on-chain
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          <LuFileUp aria-hidden className="size-3.5" /> Hash a file
        </Button>
      </div>
      {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      {result && (
        <div className="rounded-lg border border-line bg-surface/60 p-3">
          <div className="flex items-center gap-2">
            <Badge tone={result.verified ? "success" : "danger"}>
              {result.verified ? <LuShieldCheck aria-hidden className="size-3" /> : <LuShieldX aria-hidden className="size-3" />}
              {result.verified ? "Proven on-chain" : "Not proven"}
            </Badge>
            <span className="text-[11px] text-fg-subtle">{result.anchors.length} matching anchor{result.anchors.length === 1 ? "" : "s"}</span>
          </div>
          {result.anchors.length ? (
            <ul className="mt-2 space-y-1.5">
              {result.anchors.map((a) => (
                <li key={a.id} className="text-[11.5px] leading-5 text-fg-muted">
                  <span className="font-medium text-fg">{a.kind.replace(/_/g, " ")}</span>
                  {a.blockNumber ? ` · block ${a.blockNumber}` : ""}
                  {a.reason ? ` · ${a.reason}` : a.onChain ? " · calldata matches" : ""}
                  {a.explorerUrl && (
                    <a href={a.explorerUrl} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
                      Explorer
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11.5px] text-fg-muted">No anchor in this workspace commits to that hash.</p>
          )}
        </div>
      )}
    </div>
  );
}
