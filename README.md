# Legal Flow — app

Privacy-first multi-agent legal workflow platform: sessions-based accounts, an encrypted vault, agent workflows, and a Next.js dashboard.

## Run it
```bash
cp .env.example .env.local     # set DATABASE_URL + DIRECT_URL, APP_API_KEY (optional) + VAULT_ENCRYPTION_KEY (openssl rand -base64 32); add GEMINI_/GROQ_ keys
pnpm db:setup                  # create the users + sessions tables
pnpm dev                       # file storage in ./.data locally; use Upstash + Vercel Blob in production
pnpm test                      # redaction, LLM router resilience, full pipeline with a fake model
```
Open `/sign-up` to create an account, then `/sign-in`. Every `(dashboard)` page redirects to `/sign-in` without a valid session. API routes accept that session cookie; `APP_API_KEY` remains an optional bearer token for scripts. Responses are `{ data }` or `{ error: { code, message, details? } }`.

## How a request flows (the privacy guarantee)
`upload → SHA-256 verify → parse (pdf/docx/txt) → AES-GCM encrypt original+text → redact (wink-nlp + regex) → vault`
`run → engine loads ONLY redacted text → agents → outbound guard on every prompt → LLM → rehydrate at the final Deliverable node`
Tokens are keyed hashes per matter (stable across docs, no coordination); dates are shifted by a per-matter offset so timelines keep order and intervals, then un-shifted on output.

## Code map
| Path | Role |
|---|---|
| `lib/redact.ts` | PII masking, reversible, isomorphic (browser + server) |
| `lib/llm/*` | Gemini + Groq adapters; `router.ts` = tiers, retry/backoff, fallback, zod-validated JSON with self-repair |
| `lib/agents/*` | Node defs, `engine.ts` (React Flow JSON → LangGraph.js), validator, prompts, quality gate |
| `lib/chain.ts`, `services/anchors.ts` | Sepolia proofs via viem (calldata = `LF1` + SHA-256) and independent verification |
| `lib/auth/*`, `lib/db.ts` | scrypt password hashing, database sessions, route/page guards; Postgres pool |
| `lib/store/*` | KV + blob drivers (file / Upstash+Vercel Blob), sealed (encrypted) records |
| `lib/services/*` | cases, documents (vault), workflows, runs, outputs, chat, settings |
| `app/api/**` | thin route handlers over the services |

## API
| Page | Routes |
|---|---|
| Dashboard | `GET /api/dashboard`, `GET /api/system`, `GET /api/health` (no auth) |
| Auth | `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/auth/session` |
| Chat | `POST /api/chat` (SSE: `meta`, `status`, `delta`, `workflow`, `done`, `error`) · `GET /api/chat/conversations[/:id]` |
| Workflows | `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/:id`, `GET /api/workflows/templates`, `POST /api/workflows/validate`, `POST /api/workflows/generate`, `GET /api/node-types` |
| Cases | `GET/POST /api/cases`, `GET/PATCH/DELETE /api/cases/:id`, `POST /api/cases/:id/reredact` |
| Vault | `GET/POST /api/documents` (multipart `file`, `caseId`, `clientHash`, `anchor`), `GET/DELETE /api/documents/:id`, `…/text?view=original\|redacted`, `…/download`, `…/verify`, `…/anchor`, `…/reredact`, `POST /api/documents/upload-token` + `/ingest` (large files), `GET /api/vault/entries`, `POST /api/vault/preview` |
| Agents | `GET /api/agents`, `POST /api/runs` (202), `GET /api/runs[/:id]`, `…/logs?after=`, `…/stream` (SSE), `…/cancel`, `…/resume` |
| Outputs | `GET /api/outputs`, `GET/DELETE /api/outputs/:id`, `GET /api/outputs/:id/export?format=docx\|md\|json` |
| Audit | `GET /api/audit`, `POST /api/audit/anchors`, `GET /api/audit/verify?hash=`, `GET /api/audit/payload?hash=` (for wallet signing) |
| Settings | `GET/PUT /api/settings` (redaction rules + firm playbook) |

## Decisions worth knowing
- **Wink has no person-name model**, so names are heuristic (proper-noun runs). Add parties to a case's `knownTerms` for precise redaction; over-redaction is the deliberate failure mode.
- **Resumable runs**: Vercel functions are time-limited, so every LLM chunk result is cached per run; `resume` only redoes unfinished work. A heartbeat tells "running" from "killed".
- **Quality-gate retries** are a bounded loop inside the gate node, keeping the graph a DAG (a graph cycle would re-fire downstream nodes and break fan-in joins).
- **Anchors** commit to a run *manifest* (doc hashes + output hash + models), so one tx proves the whole execution. Only a hash ever goes on-chain.
- **Scanned PDFs are rejected** (OCR would mean sending raw pages to a cloud model before redaction). OCR locally, then upload.

## Known limits / next steps
Password reset and email verification are not implemented yet; no rate limiting on sign-in; cross-batch contradictions are skipped for timelines beyond ~450k chars (logged as a warning); Sepolia anchoring needs a funded testnet key; the LLM adapters were verified against SDK types and the router by tests, but not against live Gemini/Groq.
