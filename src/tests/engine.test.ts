import { test } from "node:test";
import assert from "node:assert/strict";
import { runWorkflow } from "../lib/agents/engine";
import type { OutputContent, RunContext, LogEntry } from "../lib/agents/context";
import { makeOutboundGuard } from "../lib/agents/guard";
import { validateWorkflow } from "../lib/agents/validate";
import type { WorkflowGraph } from "../lib/agents/schemas";
import { LLMRouter } from "../lib/llm/router";
import type { LLMRequest, Provider } from "../lib/llm/types";
import { Redactor } from "../lib/redact";

process.env.LLM_CONCURRENCY = "2";

const RAW_DOCS = [
  { id: "d1", name: "Johnson Deposition.txt", text: "[[PAGE 1]]\nA. I first met Sarah Johnson on 2021-03-03 at the Acme office.\nA. I never signed the contract with Acme Corp." },
  { id: "d2", name: "Email Chain.txt", text: "[[PAGE 1]]\nA. On 2021-03-20 Sarah Johnson emailed the signed contract to Acme Corp." },
];

/** Fake model: deterministic, schema-aware, and records every prompt so privacy can be asserted. */
function fakeProvider(prompts: string[], state = { questionCalls: 0 }): Provider {
  const complete = async (req: LLMRequest): Promise<string> => {
    const sys = req.system ?? "";
    const user = req.messages.map((m) => m.content).join("\n");
    prompts.push(sys + "\n" + user);
    if (sys.includes("Extract a chronology")) {
      const events = user.split("\n").filter((l) => l.startsWith("A. ")).map((l) => ({
        date: /\d{4}-\d{2}-\d{2}/.exec(l)?.[0] ?? null, datePrecision: "day", type: "statement", description: l.slice(3),
        speaker: "witness", actors: [], quote: l, page: 1, confidence: "high",
      }));
      return JSON.stringify({ events });
    }
    if (sys.includes("Identify genuine inconsistencies")) {
      const ids = [...user.matchAll(/^(ev_\d+) \|/gm)].map((m) => m[1]);
      return JSON.stringify({ contradictions: [{ title: "Signed vs never signed", category: "testimony_vs_document", severity: "high", eventIds: [ids[0], ids[ids.length - 1], "ev_9999"], explanation: "Witness denies signing; email shows signed contract.", impeachmentValue: "Confront with email." }] });
    }
    if (sys.includes("examination outline")) {
      state.questionCalls++;
      const revised = user.includes("REVISION REQUIRED");
      return JSON.stringify({ questions: [
        { section: "Contract", kind: "pin_down", text: revised ? "Did you sign the contract?" : "Tell me about signing", purpose: "lock in", contradictionIds: ["c_1", "c_404"], eventIds: ["ev_0001", "nope"], exhibits: [] },
        { section: "Contract", kind: "impeachment", text: "Isn't it true the signed contract was emailed on March 20?", purpose: "impeach", contradictionIds: ["c_1"], eventIds: ["ev_0002"], exhibits: ["Email Chain"] },
      ] });
    }
    return "{}";
  };
  return { id: "groq", model: "fake", maxContextChars: 1e9, complete, async *stream(r) { yield await complete(r); } };
}

function harness(redactor: Redactor, prompts: string[], state = { questionCalls: 0 }) {
  const p = fakeProvider(prompts, state);
  const logs: LogEntry[] = [];
  const saved: OutputContent[] = [];
  const cache = new Map<string, unknown>();
  const ctx: RunContext = {
    runId: "run_t", caseId: null, redactor, runInput: {}, playbook: [],
    llm: new LLMRouter({ chains: { long: [p], fast: [p] }, outbound: makeOutboundGuard(redactor), sleep: async () => {} }),
    emit: async (e) => void logs.push({ ts: "", runId: "run_t", ...e }),
    cacheGet: async <T,>(k: string) => (cache.get(k) as T) ?? null,
    cachePut: async (k, v) => void cache.set(k, v),
    loadDocuments: async () => RAW_DOCS.map((d) => ({ id: d.id, name: d.name, text: redactor.redact(d.text).text, pages: 1 })),
    saveOutput: async ({ content }) => (saved.push(content), { outputId: "out_1", hash: "h" }),
  };
  return { ctx, logs, saved, cache };
}

const PIPELINE: WorkflowGraph = {
  nodes: [
    { id: "src", type: "source.documents", position: { x: 0, y: 0 }, data: { config: {} } },
    { id: "tl", type: "agent.timeline", position: { x: 0, y: 0 }, data: { config: {} } },
    { id: "inc", type: "agent.inconsistency", position: { x: 0, y: 0 }, data: { config: {} } },
    { id: "q", type: "agent.questions", position: { x: 0, y: 0 }, data: { config: { witness: "Sarah Johnson" } } },
    { id: "gate", type: "control.qualityGate", position: { x: 0, y: 0 }, data: { config: { target: "q" } } },
    { id: "out", type: "output.deliverable", position: { x: 0, y: 0 }, data: { config: {} } },
  ],
  edges: [{ source: "src", target: "tl" }, { source: "tl", target: "inc" }, { source: "inc", target: "q" }, { source: "q", target: "gate" }, { source: "gate", target: "out" }],
};

test("deposition pipeline: private, grounded, gated, rehydrated", async () => {
  const prompts: string[] = [];
  const state = { questionCalls: 0 };
  const redactor = new Redactor({ dateShiftDays: 45, known: [{ value: "Sarah Johnson", aliases: ["Johnson"] }] });
  const h = harness(redactor, prompts, state);
  const res = await runWorkflow(PIPELINE, h.ctx);

  // privacy: nothing raw reached a model
  const all = prompts.join("\n");
  for (const raw of ["Sarah Johnson", "Acme", "2021-03-03", "2021-03-20"]) assert.ok(!all.includes(raw), `prompt leaked ${raw}`);

  // gate sent the first (non-question) draft back exactly once
  assert.equal(state.questionCalls, 2);
  assert.ok(h.logs.some((l) => l.agent === "Quality Gate" && /Rejected/.test(l.message)));
  assert.equal(res.warnings.length, 0);

  // hallucinated ids dropped; real contradiction kept
  const out = h.saved[0]!;
  assert.equal(out.kind, "trial_outline");
  assert.equal(out.data.contradictions?.length, 1);
  assert.deepEqual(out.data.contradictions![0]!.eventIds.length, 2);
  assert.ok(out.data.questions!.every((q) => !q.eventIds.includes("nope") && !q.contradictionIds.includes("c_404")));

  // rehydrated for the attorney: real name back, ORIGINAL (unshifted) dates back
  const json = JSON.stringify(out);
  assert.ok(json.includes("Sarah Johnson"));
  assert.ok(json.includes("2021-03-03") && json.includes("2021-03-20"));
  assert.equal(res.outputs.length, 1);
});

test("timeline events carry verified quotes; re-run hits the cache", async () => {
  const prompts: string[] = [];
  const redactor = new Redactor({ dateShiftDays: 10 });
  const h = harness(redactor, prompts);
  await runWorkflow(PIPELINE, h.ctx);
  const calls1 = prompts.length;
  await runWorkflow(PIPELINE, h.ctx);
  const extra = prompts.length - calls1;
  assert.ok(extra <= 3, `timeline/inconsistency should be cached on re-run (extra calls: ${extra})`);
});

test("validator catches bad canvases before any LLM call", () => {
  const bad: WorkflowGraph = {
    nodes: [
      { id: "a", type: "agent.questions", position: { x: 0, y: 0 }, data: { config: {} } },
      { id: "b", type: "agent.timeline", position: { x: 0, y: 0 }, data: { config: {} } },
    ],
    edges: [{ source: "a", target: "b" }, { source: "b", target: "a" }],
  };
  const msgs = validateWorkflow(bad).issues.map((i) => i.message).join(" | ");
  assert.match(msgs, /cycle/);
  assert.match(msgs, /Deliverable/);
  assert.match(msgs, /Documents source/);
  assert.match(msgs, /needs an input/);
});

test("privacy guard blocks a node that forgot to redact", async () => {
  const redactor = new Redactor({ known: [{ value: "Sarah Johnson" }] });
  redactor.redact("Sarah Johnson"); // mint the vault entry
  const guard = makeOutboundGuard(redactor);
  assert.ok(!guard("ask Sarah Johnson", "t").includes("Sarah"));
});
