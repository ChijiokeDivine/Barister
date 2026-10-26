import { describe, expect, test } from "bun:test";
import {
  initWorkflow,
  verifyAnchorProof,
  type Config,
  type ProofVerification,
} from "./workflow";

const HASH = "a".repeat(64);
const TX_HASH = "0x" + "b".repeat(64);
const SELF = "0x" + "1".repeat(40);
const OTHER = "0x" + "2".repeat(40);

const anchor = {
  id: "anc_test",
  kind: "run_proof",
  hash: HASH,
  txHash: TX_HASH,
  blockNumber: 123,
};

const matchingTx = {
  hash: TX_HASH,
  from: SELF,
  to: SELF,
  value: "0x0",
  input: `0x4c4631${HASH}`,
  blockNumber: "0x7b",
};

const matchingReceipt = { status: "0x1", blockNumber: "0x7b" };

describe("verifyAnchorProof", () => {
  test("verifies a matching LF1 self-transaction with zero value", () => {
    const result = verifyAnchorProof(anchor, matchingTx, matchingReceipt, "0x4c4631");
    expect(result.status).toBe("verified");
    expect(result.reasons).toEqual([]);
    expect(result.blockNumber).toBe(123);
  });

  test("detects calldata tampering", () => {
    const result = verifyAnchorProof(
      anchor,
      { ...matchingTx, input: `0x4c4631${"c".repeat(64)}` },
      matchingReceipt,
      "0x4c4631",
    );
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("calldata does not match proofPrefix + SHA-256");
  });

  test("detects a non-self transaction", () => {
    const result = verifyAnchorProof(anchor, { ...matchingTx, to: OTHER }, matchingReceipt, "0x4c4631");
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("transaction is not a self-transaction");
  });

  test("detects a non-zero value", () => {
    const result = verifyAnchorProof(anchor, { ...matchingTx, value: "0x1" }, matchingReceipt, "0x4c4631");
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("transaction value is not zero");
  });

  test("reports a reverted transaction as failed", () => {
    const result = verifyAnchorProof(anchor, matchingTx, { ...matchingReceipt, status: "0x0" }, "0x4c4631");
    expect(result.status).toBe("failed");
    expect(result.reasons).toContain("transaction reverted");
  });

  test("reports a missing transaction as not_found", () => {
    const result = verifyAnchorProof(anchor, null, null, "0x4c4631");
    expect(result.status).toBe("not_found");
  });

  test("reports a transaction without a receipt as pending", () => {
    const result = verifyAnchorProof(anchor, matchingTx, null, "0x4c4631");
    expect(result.status).toBe("pending");
  });

  test("reports an anchor without a txHash as invalid", () => {
    const result = verifyAnchorProof({ ...anchor, txHash: undefined }, null, null, "0x4c4631");
    expect(result.status).toBe("invalid");
    expect(result.reasons).toContain("anchor has no transaction hash");
  });

  test("detects a receipt block mismatch", () => {
    const result = verifyAnchorProof(anchor, matchingTx, { ...matchingReceipt, blockNumber: "0x7c" }, "0x4c4631");
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("receipt block number does not match the audit ledger");
  });
});

describe("initWorkflow", () => {
  test("registers exactly one HTTP handler", () => {
    const config: Config = {
      apiUrl: "http://127.0.0.1:8787/api/audit",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      chainSelectorName: "ethereum-testnet-sepolia",
      proofPrefix: "0x4c4631",
      maxAnchors: 10,
      authorizedKeys: [],
      requireAuthorizedKeys: false,
    };

    const handlers = initWorkflow(config);
    expect(handlers).toHaveLength(1);
  });

  test("fails closed when a production target has no authorized keys", () => {
    const config: Config = {
      apiUrl: "https://barister.example.com/api/audit",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      chainSelectorName: "ethereum-testnet-sepolia",
      proofPrefix: "0x4c4631",
      maxAnchors: 10,
      authorizedKeys: [],
      requireAuthorizedKeys: true,
    };

    expect(() => initWorkflow(config)).toThrow("authorized EVM public key");
  });
});

// Compile-time guard: keep the public result type stable for consumers of this module.
const _typecheck: ProofVerification["status"] = "verified";
void _typecheck;
