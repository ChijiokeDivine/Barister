/**
 * Anchor records = our local ledger of what was written to Sepolia. The CHAIN is the source of truth; this ledger
 * just makes the audit page fast and lets us re-verify (recompute hash → compare with tx calldata → read block time).
 */
import { anchorHash, chainConfigured, getTxStatus, inputMatches, txUrl, CHAIN } from "../chain";
import { badRequest, notConfigured, notFound } from "../errors";
import { hashJSON, isSha256Hex } from "../hash";
import { newId, nowIso } from "../ids";
import { plainRepo } from "../store/repo";

export type AnchorKind = "document" | "run_proof" | "custom";
export interface AnchorRecord {
  id: string;
  kind: AnchorKind;
  refId: string | null;
  hash: string; // the 32-byte digest actually written on-chain
  /** Non-sensitive preimage (ids + hashes only) so the hash can be recomputed independently. Present for run proofs. */
  payload?: unknown;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  from?: string;
  chainId: number;
  blockNumber?: number;
  blockTimestamp?: string;
  explorerUrl?: string;
  error?: string;
  createdAt: string;
}

export const anchors = plainRepo<AnchorRecord>("anchors");

export async function createAnchor(input: { kind: AnchorKind; refId?: string | null; hash: string; payload?: unknown }): Promise<AnchorRecord> {
  if (!isSha256Hex(input.hash)) throw badRequest("hash must be a 64-char SHA-256 hex digest");
  if (!chainConfigured()) throw notConfigured("On-chain anchoring (set ANCHOR_PRIVATE_KEY)");
  const hash = input.hash.toLowerCase();

  // Idempotency: don't pay gas twice to prove the same thing.
  const existing = (await anchors.list()).find((a) => a.hash === hash && a.kind === input.kind && a.status !== "failed");
  if (existing) return existing;

  const base: AnchorRecord = { id: newId("anc"), kind: input.kind, refId: input.refId ?? null, hash, payload: input.payload, status: "pending", chainId: CHAIN.id, createdAt: nowIso() };
  try {
    const { txHash, from } = await anchorHash(hash);
    return anchors.put({ ...base, txHash, from, explorerUrl: txUrl(txHash) });
  } catch (e) {
    // Keep the failed attempt visible in the ledger (and retryable) instead of silently losing it.
    await anchors.put({ ...base, status: "failed", error: (e as Error).message });
    throw e;
  }
}

/** Polls the chain for a pending anchor and persists the result. Cheap no-op for settled ones. */
export async function refreshAnchor(a: AnchorRecord): Promise<AnchorRecord> {
  if (a.status !== "pending" || !a.txHash) return a;
  const st = await getTxStatus(a.txHash).catch(() => null);
  if (!st || st.status === "pending") return a;
  if (st.status === "not_found") {
    // A tx dropped from the mempool never confirms; give it 30 min before declaring it failed.
    return Date.now() - Date.parse(a.createdAt) > 30 * 60_000 ? anchors.put({ ...a, status: "failed", error: "Transaction not found on chain" }) : a;
  }
  return anchors.put({ ...a, status: st.status === "confirmed" ? "confirmed" : "failed", blockNumber: st.blockNumber, blockTimestamp: st.timestamp, error: st.status === "failed" ? "Transaction reverted" : undefined });
}

export async function listAnchors(opts: { refresh?: boolean; kind?: AnchorKind } = {}) {
  let list = await anchors.list();
  if (opts.kind) list = list.filter((a) => a.kind === opts.kind);
  if (opts.refresh) {
    // Bounded: at most 10 chain reads per page load.
    const pending = list.filter((a) => a.status === "pending").slice(0, 10);
    const updated = await Promise.all(pending.map(refreshAnchor));
    const byId = new Map(updated.map((a) => [a.id, a]));
    list = list.map((a) => byId.get(a.id) ?? a);
  }
  return list;
}

export async function getAnchor(id: string) {
  const a = await anchors.get(id);
  if (!a) throw notFound("Anchor");
  return a;
}

export interface Verification {
  hash: string;
  verified: boolean;
  anchors: { id: string; kind: AnchorKind; txHash?: string; explorerUrl?: string; onChain: boolean; blockNumber?: number; blockTimestamp?: string; reason?: string }[];
}

/**
 * Independent verification: for each anchor of this hash, read the tx FROM THE CHAIN and confirm its calldata is
 * exactly our proof of this digest. Doesn't trust our ledger's own status field.
 */
export async function verifyHash(hash: string): Promise<Verification> {
  if (!isSha256Hex(hash)) throw badRequest("hash must be a 64-char SHA-256 hex digest");
  const h = hash.toLowerCase();
  const matches = (await anchors.list()).filter((a) => a.hash === h && a.txHash);
  const results = await Promise.all(
    matches.map(async (a) => {
      const st = await getTxStatus(a.txHash!).catch(() => null);
      const ok = st?.status === "confirmed" && inputMatches(st.input, h);
      return {
        id: a.id, kind: a.kind, txHash: a.txHash, explorerUrl: a.explorerUrl, onChain: ok, blockNumber: st?.blockNumber, blockTimestamp: st?.timestamp,
        reason: ok ? undefined : !st ? "RPC unavailable" : st.status !== "confirmed" ? `transaction ${st.status}` : "calldata does not match",
      };
    }),
  );
  return { hash: h, verified: results.some((r) => r.onChain), anchors: results };
}

/** Run manifest = the thing a "run_proof" anchor commits to. Hash is over canonical JSON so it's reproducible. */
export interface RunManifest {
  v: 1;
  runId: string;
  workflowHash: string;
  documents: { id: string; sha256: string }[];
  outputs: { id: string; sha256: string }[];
  models: string[];
  completedAt: string;
}
export const manifestHash = (m: RunManifest) => hashJSON(m);
