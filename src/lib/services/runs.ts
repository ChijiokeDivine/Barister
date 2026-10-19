/**
 * Run lifecycle: create (validate synchronously) → execute (background) → logs/cancel/resume.
 *
 * Vercel constraint: a function can't live forever. So execution is built to be RESUMABLE:
 *  - every expensive LLM result is cached per run (sealed) — a re-execution only redoes what never finished;
 *  - a heartbeat distinguishes "still running" from "function was killed", so the UI can offer Resume.
 */
import { runWorkflow } from "../agents/engine";
import type { LogEntry, OutputContent, RunContext } from "../agents/context";
import { makeOutboundGuard } from "../agents/guard";
import type { WorkflowGraph } from "../agents/schemas";
import { validateWorkflow } from "../agents/validate";
import { chainConfigured } from "../chain";
import { openJSON, sealJSON } from "../crypto";
import { badRequest, conflict, notFound } from "../errors";
import { hashJSON } from "../hash";
import { newId, nowIso } from "../ids";
import { LLMRouter } from "../llm/router";
import { kv } from "../store";
import { sealedRepo } from "../store/repo";
import { errMsg } from "../util";
import { createAnchor, manifestHash, type RunManifest } from "./anchors";
import { getCase } from "./cases";
import { getDocument, loadRedactedDocs } from "./documents";
import { saveOutputContent } from "./outputs";
import { buildRedactor, persistVault } from "./redaction";
import { getSettings } from "./settings";
import { getWorkflow } from "./workflows";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export interface RunRecord {
  id: string;
  workflowId: string | null;
  workflowName: string;
  caseId: string | null;
  graph: WorkflowGraph; // snapshot: later edits to the workflow must not change what a past run did
  docIds?: string[];
  instructions?: string;
  status: RunStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  heartbeatAt?: string;
  attempts: number;
  error?: string;
  warnings: string[];
  outputs: { nodeId: string; outputId: string; hash: string }[];
  models: string[];
  proofAnchorId?: string;
  proofError?: string;
}

export const runs = sealedRepo<RunRecord>("runs");
const STALE_MS = 120_000;

export async function createRun(input: { workflowId?: string; graph?: WorkflowGraph; name?: string; caseId?: string | null; docIds?: string[]; instructions?: string }): Promise<RunRecord> {
  let graph = input.graph;
  let name = input.name ?? "Ad-hoc workflow";
  if (input.workflowId) {
    const w = await getWorkflow(input.workflowId);
    graph = w.graph;
    name = w.name;
  }
  if (!graph) throw badRequest("Provide workflowId or graph");
  const caseId = input.caseId ?? null;
  if (caseId) await getCase(caseId); // 404 early

  // Fail fast: a broken canvas should error in milliseconds, before a run row exists or any model is called.
  const { issues } = validateWorkflow(graph);
  if (issues.length) throw badRequest("Workflow is invalid", issues);
  if (input.docIds?.length) await Promise.all(input.docIds.map(getDocument));

  return runs.put({
    id: newId("run"), workflowId: input.workflowId ?? null, workflowName: name, caseId, graph, docIds: input.docIds, instructions: input.instructions,
    status: "queued", createdAt: nowIso(), attempts: 0, warnings: [], outputs: [], models: [],
  });
}

export async function getRun(id: string): Promise<RunRecord> {
  const r = await runs.get(id);
  if (!r) throw notFound("Run");
  // Heartbeat lives in its own hash field (never read-modify-write on the run record), so it can't clobber status.
  const hb = (await kv().hgetall(`runctl:${id}`)).hb;
  return hb ? { ...r, heartbeatAt: hb } : r;
}

/** A "running" run whose heartbeat stopped is really dead (function killed) → report it as resumable. */
export const isStale = (r: RunRecord) => r.status === "running" && Date.now() - Date.parse(r.heartbeatAt ?? r.startedAt ?? r.createdAt) > STALE_MS;

export async function requestCancel(id: string) {
  const r = await getRun(id);
  if (r.status !== "running" && r.status !== "queued") throw conflict(`Run is already ${r.status}`);
  await kv().hset(`runctl:${id}`, { cancel: "1" });
  if (r.status === "queued" || isStale(r)) await runs.put({ ...r, status: "cancelled", finishedAt: nowIso() });
}

export async function getLogs(id: string, after = 0, limit = 500) {
  const raw = await kv().lrange(`runlog:${id}`, after, after + limit - 1);
  const entries = raw.map((s) => openJSON<LogEntry>(s));
  return { entries, next: after + entries.length };
}

/** Last `n` log entries without reading the whole list (negative lrange start works on both drivers). */
export async function getLogTail(id: string, n = 40): Promise<LogEntry[]> {
  return (await kv().lrange(`runlog:${id}`, -n, -1)).map((s) => openJSON<LogEntry>(s));
}

/** Executes (or resumes) a run to completion. Never throws: failures are recorded on the run. */
export async function executeRun(id: string): Promise<RunRecord> {
  let run = await getRun(id);
  if (run.status === "running" && !isStale(run)) throw conflict("Run is already executing");
  if (run.status === "succeeded") return run;

  const abort = new AbortController();
  run = await runs.put({ ...run, status: "running", startedAt: run.startedAt ?? nowIso(), heartbeatAt: nowIso(), attempts: run.attempts + 1, error: undefined, finishedAt: undefined });
  await kv().hset(`runctl:${id}`, { cancel: "", hb: nowIso() });

  // Per-run resume cache, preloaded so cacheGet is synchronous-fast.
  const cache = new Map<string, unknown>(Object.entries(await kv().hgetall(`runcache:${id}`)).map(([k, v]) => [k, openJSON<unknown>(v)]));
  const models = new Set(run.models);
  const produced: { nodeId: string; outputId: string; hash: string; anchor: boolean }[] = [];
  const loadedDocs = new Map<string, string>(); // docId → sha256 of original (for the proof manifest)
  let lastBeat = 0;

  const redactor = await buildRedactor(run.caseId);
  const settings = await getSettings();

  const emit: RunContext["emit"] = async (e) => {
    const entry: LogEntry = { ...e, ts: nowIso(), runId: id };
    await kv().rpush(`runlog:${id}`, [sealJSON(entry)]);
    if (Date.now() - lastBeat > 2_000) {
      lastBeat = Date.now();
      // Heartbeat + cooperative cancel check, throttled so logging stays cheap.
      await kv().hset(`runctl:${id}`, { hb: nowIso() });
      if ((await kv().hgetall(`runctl:${id}`)).cancel === "1") abort.abort();
    }
  };

  const llm = new LLMRouter({
    outbound: makeOutboundGuard(redactor, (where) => void emit({ agent: "Privacy Guard", level: "warn", message: `Scrubbed unredacted data from an outbound prompt (${where}).` }).catch(() => undefined)),
    onEvent: (ev) => {
      if (!ev.error) models.add(`${ev.provider}:${ev.model}`);
      else emit({ agent: "Model Router", level: "warn", message: `${ev.provider}/${ev.model} failed (attempt ${ev.attempt + 1}): ${ev.error}` }).catch(() => undefined);
    },
  });

  const ctx: RunContext = {
    runId: id, caseId: run.caseId, redactor, llm, signal: abort.signal, runInput: { docIds: run.docIds, instructions: run.instructions },
    playbook: settings.playbook,
    emit,
    cacheGet: async <T,>(k: string) => (cache.get(k) as T | undefined) ?? null,
    cachePut: async (k, v) => {
      cache.set(k, v);
      await kv().hset(`runcache:${id}`, { [k]: sealJSON(v) });
    },
    loadDocuments: async (docIds) => {
      const docs = await loadRedactedDocs(docIds, run.caseId);
      await Promise.all(docs.map(async (d) => loadedDocs.set(d.id, (await getDocument(d.id)).sha256)));
      return docs;
    },
    saveOutput: async ({ content, anchor }: { content: OutputContent; anchor: boolean }) => {
      const rec = await saveOutputContent({ runId: id, caseId: run.caseId, content });
      produced.push({ nodeId: "", outputId: rec.id, hash: rec.hash, anchor });
      return { outputId: rec.id, hash: rec.hash };
    },
  };

  try {
    await emit({ agent: "Orchestrator", level: "info", message: `${run.attempts > 1 ? "Resuming" : "Starting"} "${run.workflowName}" (${run.graph.nodes.length} nodes).` });
    const result = await runWorkflow(run.graph, ctx);
    const outputs = result.outputs.map((o) => ({ nodeId: o.nodeId, outputId: o.outputId, hash: o.hash }));

    let proofAnchorId: string | undefined;
    let proofError: string | undefined;
    if (produced.some((p) => p.anchor) && !abort.signal.aborted) {
      if (!chainConfigured()) {
        proofError = "On-chain anchoring requested but ANCHOR_PRIVATE_KEY is not configured";
      } else {
        try {
          const manifest: RunManifest = {
            v: 1, runId: id, workflowHash: await hashJSON(run.graph),
            documents: [...loadedDocs].map(([docId, sha256]) => ({ id: docId, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
            outputs: outputs.map((o) => ({ id: o.outputId, sha256: o.hash })).sort((a, b) => a.id.localeCompare(b.id)),
            models: [...models].sort(), completedAt: nowIso(),
          };
          const anchor = await createAnchor({ kind: "run_proof", refId: id, hash: await manifestHash(manifest), payload: manifest });
          proofAnchorId = anchor.id;
          await emit({ agent: "Proof Layer", level: "decision", message: `Execution proof broadcast to Sepolia: ${anchor.explorerUrl}` });
        } catch (e) {
          proofError = errMsg(e);
          await emit({ agent: "Proof Layer", level: "warn", message: `Anchoring failed (results are unaffected): ${proofError}` });
        }
      }
    }

    await kv().delKey(`runcache:${id}`); // success: the cache has done its job
    return await runs.put({ ...(await getRun(id)), status: "succeeded", finishedAt: nowIso(), outputs, warnings: result.warnings, models: [...models], proofAnchorId, proofError });
  } catch (e) {
    const cancelled = abort.signal.aborted;
    await emit({ agent: "Orchestrator", level: cancelled ? "warn" : "error", message: cancelled ? "Run cancelled." : errMsg(e) });
    return await runs.put({ ...(await getRun(id)), status: cancelled ? "cancelled" : "failed", finishedAt: nowIso(), error: cancelled ? undefined : errMsg(e), models: [...models] });
  } finally {
    // Persist tokens minted during the run (witness names in configs, filenames…) so later chat/exports can restore them.
    await persistVault(run.caseId, redactor).catch(() => undefined);
  }
}

export async function listRuns(opts: { status?: RunStatus; caseId?: string } = {}) {
  let list = await runs.list();
  if (opts.status) list = list.filter((r) => r.status === opts.status);
  if (opts.caseId) list = list.filter((r) => r.caseId === opts.caseId);
  return list;
}
