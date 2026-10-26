/**
 * Local mock of Barister's GET /api/audit for `cre workflow simulate`.
 *
 * This is NOT part of the deployed workflow. It lets the simulator exercise the real
 * HTTP + secret + Sepolia JSON-RPC path without needing the Next.js app running.
 *
 * Run:  BARISTER_API_KEY_VAR=local-simulation-token bun run tools/mock-audit-server.ts
 * Then: cre workflow simulate audit-anchor-verifier --target staging-settings ...
 */
const PORT = Number(process.env.MOCK_AUDIT_PORT ?? 8787);
const TOKEN = process.env.BARISTER_API_KEY_VAR;

if (!TOKEN) {
  console.error("Set BARISTER_API_KEY_VAR before starting the mock server.");
  process.exit(1);
}

// A real, confirmed Sepolia transaction used to exercise the onchain mismatch path.
const REAL_TX = "0xf9ebdb9727761e5c05eae47b1450aed2d91b341604c84fc5040740f1b1b7c3f3";

const anchors = [
  {
    id: "anc_demo_mismatch",
    kind: "run_proof",
    refId: "run_demo_1",
    // This hash does not match the real transaction's calldata, so the verifier must flag it.
    hash: "a".repeat(64),
    status: "confirmed",
    txHash: REAL_TX,
    chainId: 11155111,
    blockNumber: 11998617,
    blockTimestamp: "2026-10-26T14:34:48.000Z",
    explorerUrl: `https://sepolia.etherscan.io/tx/${REAL_TX}`,
    createdAt: "2026-10-26T14:35:00.000Z",
  },
  {
    id: "anc_demo_not_found",
    kind: "document",
    refId: "doc_demo_1",
    hash: "b".repeat(64),
    status: "confirmed",
    txHash: "0x" + "0".repeat(64),
    chainId: 11155111,
    createdAt: "2026-10-26T14:36:00.000Z",
  },
  {
    id: "anc_demo_never_anchored",
    kind: "custom",
    refId: null,
    hash: "c".repeat(64),
    status: "pending",
    chainId: 11155111,
    createdAt: "2026-10-26T14:37:00.000Z",
  },
];

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/audit") {
      return Response.json({ error: { code: "not_found", message: "not found" } }, { status: 404 });
    }
    if (request.headers.get("authorization") !== `Bearer ${TOKEN}`) {
      return Response.json({ error: { code: "unauthorized", message: "bad token" } }, { status: 401 });
    }
    return Response.json({
      data: {
        explorer: "https://sepolia.etherscan.io",
        network: "sepolia",
        anchors,
      },
    });
  },
});

console.log(`[mock-audit] listening on http://127.0.0.1:${server.port}/api/audit`);
