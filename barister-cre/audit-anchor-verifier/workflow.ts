/**
 * Barister audit-anchor verifier (CRE / TypeScript).
 *
 * Trigger: HTTP webhook (POST JSON, optionally filtered by SHA-256 hashes).
 * Reads:   GET <apiUrl> (Barister audit ledger) using a Vault-backed bearer secret.
 * Verifies: each anchor's "LF1" + SHA-256 proof against Ethereum Sepolia over JSON-RPC.
 *
 * This workflow is intentionally READ-ONLY: it never builds a CRE report, constructs an
 * EVMClient, or calls a Forwarder. Simulation is therefore receiver-free and non-broadcast.
 */
import {
  HTTPCapability,
  HTTPClient,
  bytesToBase64,
  consensusIdenticalAggregation,
  handler,
  ok,
  text,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import type { HTTP_TRIGGER_PB } from "@chainlink/cre-sdk/pb";

type AuthorizedKey = {
  type: "KEY_TYPE_ECDSA_EVM";
  publicKey: string;
};

export type Config = {
  apiUrl: string;
  rpcUrl: string;
  chainSelectorName: string;
  /** "LF1" as hex, matching src/lib/chain.ts (stringToHex("LF1") === 0x4c4631). */
  proofPrefix: string;
  maxAnchors: number;
  /** Deployed HTTP triggers require at least one authorized EVM public key. */
  authorizedKeys: AuthorizedKey[];
  requireAuthorizedKeys: boolean;
};

type AnchorRecord = {
  id: string;
  kind: string;
  hash: string;
  txHash?: string;
  blockNumber?: number;
  status?: string;
};

type JsonRpcTx = {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  blockNumber: string | null;
};

type JsonRpcReceipt = {
  status: string;
  blockNumber: string;
};

type JsonRpcEnvelope = {
  result?: unknown;
  error?: { code?: number; message?: string };
};

export type ProofStatus =
  | "verified"
  | "mismatch"
  | "pending"
  | "failed"
  | "not_found"
  | "invalid";

export type ProofVerification = {
  id: string;
  kind: string;
  hash: string;
  txHash?: string;
  status: ProofStatus;
  reasons: string[];
  blockNumber?: number;
};

const SHA256_RE = /^[0-9a-fA-F]{64}$/;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const PREFIX_RE = /^0x[0-9a-fA-F]{6}$/;

/** Runtime config validation. Keep this explicit: QuickJS has no URL global, so do not use z.string().url(). */
export function assertConfig(config: Config): Config {
  if (typeof config.apiUrl !== "string" || !/^https?:\/\/[^\s]+$/.test(config.apiUrl)) {
    throw new Error("config.apiUrl must be an http(s) URL");
  }
  if (typeof config.rpcUrl !== "string" || !/^https?:\/\/[^\s]+$/.test(config.rpcUrl)) {
    throw new Error("config.rpcUrl must be an http(s) URL");
  }
  if (config.chainSelectorName !== "ethereum-testnet-sepolia") {
    throw new Error(
      `config.chainSelectorName must be ethereum-testnet-sepolia for this workflow (got ${config.chainSelectorName})`,
    );
  }
  if (typeof config.proofPrefix !== "string" || !PREFIX_RE.test(config.proofPrefix)) {
    throw new Error('config.proofPrefix must be 3 bytes of hex, e.g. "0x4c4631"');
  }
  if (!Number.isInteger(config.maxAnchors) || config.maxAnchors < 1 || config.maxAnchors > 10) {
    throw new Error("config.maxAnchors must be an integer between 1 and 10");
  }
  if (!Array.isArray(config.authorizedKeys)) {
    throw new Error("config.authorizedKeys must be an array");
  }
  for (const key of config.authorizedKeys) {
    if (key?.type !== "KEY_TYPE_ECDSA_EVM" || typeof key.publicKey !== "string" || key.publicKey.length === 0) {
      throw new Error("config.authorizedKeys entries need { type: KEY_TYPE_ECDSA_EVM, publicKey }");
    }
  }
  if (config.requireAuthorizedKeys && config.authorizedKeys.length === 0) {
    throw new Error(
      "config.authorizedKeys is empty; deployed HTTP triggers require at least one authorized EVM public key",
    );
  }
  return config;
}

function parseBody(input: Uint8Array): { requestId?: string; hashes: string[] } {
  if (!input || input.length === 0) return { hashes: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(input));
  } catch {
    throw new Error("HTTP trigger body must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("HTTP trigger body must be a JSON object");
  }

  const body = parsed as { requestId?: unknown; hashes?: unknown };
  if (body.requestId !== undefined && typeof body.requestId !== "string") {
    throw new Error("requestId must be a string");
  }
  if (body.hashes !== undefined && !Array.isArray(body.hashes)) {
    throw new Error("hashes must be an array of SHA-256 hex strings");
  }

  const hashes = (body.hashes ?? []).map((value) => {
    if (typeof value !== "string" || !SHA256_RE.test(value)) {
      throw new Error("each hash must be a 64-character SHA-256 hex string");
    }
    return value.toLowerCase();
  });

  return {
    requestId: body.requestId as string | undefined,
    hashes: Array.from(new Set(hashes)),
  };
}

export function normalizeAnchor(value: unknown, index: number): AnchorRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`audit API returned a malformed anchor at index ${index}`);
  }
  const anchor = value as Record<string, unknown>;
  if (typeof anchor.id !== "string" || anchor.id.length === 0) {
    throw new Error(`audit API anchor at index ${index} is missing id`);
  }
  if (typeof anchor.hash !== "string" || !SHA256_RE.test(anchor.hash)) {
    throw new Error(`audit API anchor ${anchor.id} has an invalid SHA-256 hash`);
  }
  if (anchor.txHash !== undefined && anchor.txHash !== null) {
    if (typeof anchor.txHash !== "string" || !TX_HASH_RE.test(anchor.txHash)) {
      throw new Error(`audit API anchor ${anchor.id} has an invalid txHash`);
    }
  }
  if (anchor.blockNumber !== undefined && anchor.blockNumber !== null && !Number.isInteger(anchor.blockNumber)) {
    throw new Error(`audit API anchor ${anchor.id} has an invalid blockNumber`);
  }

  return {
    id: anchor.id,
    kind: typeof anchor.kind === "string" ? anchor.kind : "unknown",
    hash: anchor.hash.toLowerCase(),
    txHash: typeof anchor.txHash === "string" ? anchor.txHash : undefined,
    blockNumber: typeof anchor.blockNumber === "number" ? anchor.blockNumber : undefined,
    status: typeof anchor.status === "string" ? anchor.status : undefined,
  };
}

/** Pure onchain-proof check, kept separate so it can be unit-tested without the DON runtime. */
export function verifyAnchorProof(
  anchor: AnchorRecord,
  tx: JsonRpcTx | null,
  receipt: JsonRpcReceipt | null,
  proofPrefix: string,
): ProofVerification {
  const base: ProofVerification = {
    id: anchor.id,
    kind: anchor.kind,
    hash: anchor.hash,
    txHash: anchor.txHash,
    status: "invalid",
    reasons: [],
  };

  if (!anchor.txHash) {
    return { ...base, reasons: ["anchor has no transaction hash"] };
  }
  if (!SHA256_RE.test(anchor.hash)) {
    return { ...base, reasons: ["anchor hash is not a SHA-256 digest"] };
  }
  if (!tx) {
    return { ...base, status: "not_found", reasons: ["transaction not found on Sepolia"] };
  }
  if (!receipt) {
    return { ...base, status: "pending", reasons: ["transaction has no receipt yet"] };
  }

  const reasons: string[] = [];
  const expectedCalldata = `${proofPrefix.toLowerCase()}${anchor.hash.toLowerCase()}`;
  if (tx.input.toLowerCase() !== expectedCalldata) {
    reasons.push("calldata does not match proofPrefix + SHA-256");
  }
  if (tx.to === null || tx.to.toLowerCase() !== tx.from.toLowerCase()) {
    reasons.push("transaction is not a self-transaction");
  }
  if (tx.value !== "0x0") {
    reasons.push("transaction value is not zero");
  }
  if (receipt.status !== "0x1") {
    reasons.push("transaction reverted");
  }

  const receiptBlock = Number.parseInt(receipt.blockNumber, 16);
  if (anchor.blockNumber !== undefined && receiptBlock !== anchor.blockNumber) {
    reasons.push("receipt block number does not match the audit ledger");
  }

  if (reasons.length > 0) {
    const reverted = receipt.status !== "0x1";
    return {
      ...base,
      status: reverted ? "failed" : "mismatch",
      reasons,
      blockNumber: receiptBlock,
    };
  }

  return { ...base, status: "verified", reasons: [], blockNumber: receiptBlock };
}

const fetchAuditLedger = (sender: HTTPSendRequester, url: string, token: string): string => {
  const response = sender
    .sendRequest({
      url,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cacheSettings: { store: false },
    })
    .result();

  if (!ok(response)) {
    throw new Error(`audit API returned HTTP ${response.statusCode}`);
  }
  return text(response);
};

const rpcCall = (sender: HTTPSendRequester, url: string, method: string, paramsJson: string): string => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method,
    params: JSON.parse(paramsJson),
  });

  const response = sender
    .sendRequest({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(new TextEncoder().encode(body)),
      cacheSettings: { store: false },
    })
    .result();

  if (!ok(response)) {
    throw new Error(`Sepolia RPC returned HTTP ${response.statusCode} for ${method}`);
  }
  return text(response);
};

function parseRpcResult(raw: string, method: string): unknown {
  let envelope: JsonRpcEnvelope;
  try {
    envelope = JSON.parse(raw) as JsonRpcEnvelope;
  } catch {
    throw new Error(`Sepolia RPC returned invalid JSON for ${method}`);
  }
  if (envelope.error) {
    throw new Error(`Sepolia RPC error for ${method}: ${envelope.error.message ?? "unknown error"}`);
  }
  return envelope.result ?? null;
}

function readTx(runtime: Runtime<Config>, txHash: string): JsonRpcTx | null {
  const raw = new HTTPClient()
    .sendRequest(runtime, rpcCall, consensusIdenticalAggregation<string>())(
      runtime.config.rpcUrl,
      "eth_getTransactionByHash",
      JSON.stringify([txHash]),
    )
    .result();
  return parseRpcResult(raw, "eth_getTransactionByHash") as JsonRpcTx | null;
}

function readReceipt(runtime: Runtime<Config>, txHash: string): JsonRpcReceipt | null {
  const raw = new HTTPClient()
    .sendRequest(runtime, rpcCall, consensusIdenticalAggregation<string>())(
      runtime.config.rpcUrl,
      "eth_getTransactionReceipt",
      JSON.stringify([txHash]),
    )
    .result();
  return parseRpcResult(raw, "eth_getTransactionReceipt") as JsonRpcReceipt | null;
}

export const onHttpTrigger = (runtime: Runtime<Config>, event: HTTP_TRIGGER_PB.Payload): string => {
  const config = runtime.config;
  const request = parseBody(event.input);
  const token = runtime.getSecret({ id: "BARISTER_API_KEY" }).result().value;

  const rawLedger = new HTTPClient()
    .sendRequest(runtime, fetchAuditLedger, consensusIdenticalAggregation<string>())(config.apiUrl, token)
    .result();

  let ledger: unknown;
  try {
    ledger = JSON.parse(rawLedger);
  } catch {
    throw new Error("audit API returned invalid JSON");
  }

  const envelope = ledger as { data?: { anchors?: unknown }; anchors?: unknown };
  const rawAnchors = envelope.data?.anchors ?? envelope.anchors;
  if (!Array.isArray(rawAnchors)) {
    throw new Error("audit API response does not contain an anchors array");
  }

  const allAnchors = rawAnchors.map((value, index) => normalizeAnchor(value, index));
  const requested = new Set(request.hashes);
  const candidates = requested.size > 0 ? allAnchors.filter((anchor) => requested.has(anchor.hash)) : allAnchors;
  const truncated = candidates.length > config.maxAnchors;
  const selected = candidates.slice(0, config.maxAnchors);

  const results: ProofVerification[] = [];
  for (const anchor of selected) {
    if (!anchor.txHash) {
      results.push(verifyAnchorProof(anchor, null, null, config.proofPrefix));
      continue;
    }
    const tx = readTx(runtime, anchor.txHash);
    const receipt = tx ? readReceipt(runtime, anchor.txHash) : null;
    results.push(verifyAnchorProof(anchor, tx, receipt, config.proofPrefix));
  }

  // A requested hash that is not in the audit ledger is itself an audit finding.
  if (requested.size > 0) {
    for (const hash of requested) {
      if (!allAnchors.some((anchor) => anchor.hash === hash)) {
        results.push({
          id: `missing:${hash}`,
          kind: "unknown",
          hash,
          status: "not_found",
          reasons: ["hash is not present in the audit ledger"],
        });
      }
    }
  }

  const summary = {
    workflow: "audit-anchor-verifier",
    mode: "read-only",
    requestId: request.requestId ?? null,
    checkedAt: runtime.now().toISOString(),
    chain: config.chainSelectorName,
    proofPrefix: config.proofPrefix,
    total: results.length,
    verified: results.filter((result) => result.status === "verified").length,
    mismatched: results.filter((result) => result.status === "mismatch").length,
    failed: results.filter((result) => result.status === "failed").length,
    pending: results.filter((result) => result.status === "pending").length,
    notFound: results.filter((result) => result.status === "not_found").length,
    invalid: results.filter((result) => result.status === "invalid").length,
    truncated,
    results,
  };

  runtime.log(
    `[audit-anchor-verifier] requestId=${summary.requestId ?? "none"} total=${summary.total} ` +
      `verified=${summary.verified} mismatched=${summary.mismatched} failed=${summary.failed} ` +
      `pending=${summary.pending} notFound=${summary.notFound} invalid=${summary.invalid} ` +
      `truncated=${summary.truncated}`,
  );

  return JSON.stringify(summary);
};

export const initWorkflow = (config: Config) => {
  assertConfig(config);
  const http = new HTTPCapability();

  return [
    handler(
      http.trigger({
        authorizedKeys: config.authorizedKeys,
      }),
      onHttpTrigger,
    ),
  ];
};
