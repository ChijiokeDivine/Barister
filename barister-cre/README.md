# Barister × Chainlink CRE

Read-only audit-anchor verification workflow for the Barister proof layer.

> **Local-only:** this folder has its own Bun/QuickJS toolchain. It is excluded from the
> Next.js TypeScript project (`tsconfig.json`), ESLint, and Vercel deploys (`.vercelignore`).
> Build and run it from `barister-cre/`; it is not part of the deployed web app.

The workflow receives an HTTP webhook, fetches Barister's `GET /api/audit` ledger with a
Vault-backed bearer secret, and verifies each `LF1 + SHA-256` anchor against Ethereum Sepolia
over JSON-RPC. It never writes onchain, so local simulation needs no receiver contract and no
gas.

## Layout

| Path | Purpose |
|---|---|
| `project.yaml` | CRE targets and the Sepolia RPC endpoint |
| `audit-anchor-verifier/workflow.yaml` | Per-target entry/config/secrets paths |
| `audit-anchor-verifier/main.ts` | HTTP trigger, audit fetch, Sepolia proof verification |
| `audit-anchor-verifier/main.test.ts` | Pure verification-logic tests |
| `audit-anchor-verifier/config.staging.json` | Local simulation config (mock audit API) |
| `audit-anchor-verifier/config.production.json` | Production placeholders + fail-closed auth |
| `secrets.yaml` | Secret IDs mapped to environment-variable names only |
| `tools/mock-audit-server.ts` | Local mock of `/api/audit` for simulation |

## Prerequisites

- CRE CLI v1.39.0 (verified with `cre version`)
- Bun 1.3.10+ (skill minimum: 1.2.21+)
- An authenticated CRE session (`cre whoami`)
- `BARISTER_API_KEY_VAR` set in the environment that launches `cre`

## Install

```bash
cd barister-cre/audit-anchor-verifier
bun install
bunx cre-setup
```

`cre-setup` downloads and verifies the Javy WASM toolchain. It is already installed on this
machine, but rerun it after a clean checkout.

## Simulate locally

Start the mock audit API in one terminal. It requires the same bearer token the workflow
resolves through `BARISTER_API_KEY`:

```bash
cd barister-cre
BARISTER_API_KEY_VAR=local-simulation-token bun run tools/mock-audit-server.ts
```

In a second terminal, from `barister-cre`:

```bash
BARISTER_API_KEY_VAR=local-simulation-token \
  cre workflow simulate audit-anchor-verifier --target staging-settings \
  --non-interactive --trigger-index 0 \
  --http-payload '{"requestId":"sim-1","hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]}'
```

Expected log line:

```text
[audit-anchor-verifier] requestId=sim-1 total=2 verified=0 mismatched=1 ... notFound=1 ...
```

The mock's first anchor points at a real Sepolia transaction whose calldata is not `LF1 + hash`,
so a `mismatch` is the correct audit result. The second points at a nonexistent transaction.
Unit tests cover the `verified` path with a matching fixture.

## Tests

```bash
cd barister-cre/audit-anchor-verifier
bun test
```

## Configuration

`config.staging.json` points at the local mock. `config.production.json` requires you to set:

- `apiUrl` — your deployed Barister origin, e.g. `https://app.your-firm.com/api/audit`
- `authorizedKeys` — the Ethereum public key(s) allowed to call the deployed HTTP trigger

`requireAuthorizedKeys: true` makes the production target fail closed until at least one key is
configured. Do not put secrets in config files; `BARISTER_API_KEY` is resolved from
`secrets.yaml` + the environment during simulation and from Vault DON when deployed.

## Deploy (not performed here)

Deployment is gated by CRE Early Access. Check status with `cre account access` (verify flags
first with `cre account access --help`). Before any deploy, the production target must have a
real `apiUrl`, at least one authorized EVM public key, a linked funded wallet, uploaded Vault
DON secrets, and a passing non-broadcast simulation.
