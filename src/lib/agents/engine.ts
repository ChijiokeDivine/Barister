/**
 * Workflow engine: compiles a React Flow graph (JSON) into a LangGraph.js StateGraph and runs it.
 *
 * Decisions:
 *  - One LangGraph node per canvas node; edges map 1:1. Fan-in (several inputs) uses addEdge([..], target),
 *    which waits for ALL upstream nodes — correct join semantics for free. Independent branches run in parallel.
 *  - State holds only artifacts (nodeId → output). Nodes never talk to each other directly, so any graph shape
 *    the validator accepts is safe to run.
 *  - Quality-gate retries are a bounded loop INSIDE the gate node (not a graph cycle): a cycle would re-fire every
 *    downstream node and break fan-in joins. The graph stays a DAG; revisions are deterministic and logged.
 *  - Failures bubble up with the node id; per-chunk LLM results are cached by the nodes, so a resumed run only
 *    redoes the work that failed.
 */
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { badRequest } from "../errors";
import { errMsg } from "../util";
import type { NodeInput, RunContext } from "./context";
import { reviewArtifact } from "./nodes/gate";
import { REGISTRY } from "./registry";
import type { Artifact, WorkflowGraph, WorkflowNode } from "./schemas";
import { validateWorkflow } from "./validate";

const State = Annotation.Root({
  // Merge-by-key reducer: parallel branches each write their own key, nothing clobbers anything.
  artifacts: Annotation<Record<string, Artifact>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  warnings: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof State.State;

export interface RunResult {
  artifacts: Record<string, Artifact>;
  warnings: string[];
  /** Deliverables produced by output nodes. */
  outputs: { nodeId: string; outputId: string; hash: string; anchorId?: string }[];
}

export async function runWorkflow(graph: WorkflowGraph, ctx: RunContext): Promise<RunResult> {
  const { issues } = validateWorkflow(graph);
  if (issues.length) throw badRequest("Workflow is invalid", issues);

  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of graph.edges) {
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]);
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
  }

  const inputsFor = (id: string, state: S): NodeInput[] =>
    (incoming.get(id) ?? []).flatMap((src) => (state.artifacts[src] ? [{ nodeId: src, artifact: state.artifacts[src]! }] : []));

  /** Runs one node def with logging; shared by normal execution and gate re-runs. */
  async function exec(node: WorkflowNode, state: S, feedback: string[], attempt: number): Promise<Artifact> {
    if (ctx.signal?.aborted) throw new Error("Run cancelled");
    const def = REGISTRY[node.type];
    const config = def.configSchema.parse(node.data.config ?? {});
    const label = node.data.label ?? def.label;
    await ctx.emit({ nodeId: node.id, agent: label, level: "info", message: attempt ? `Re-running (revision ${attempt})` : "Started", data: { node: "start", attempt } });
    const t0 = Date.now();
    try {
      const artifact = await def.run({ node, config, inputs: inputsFor(node.id, state), feedback, attempt, ctx });
      await ctx.emit({ nodeId: node.id, agent: label, level: "info", message: `Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`, data: { node: "done", attempt, ms: Date.now() - t0 } });
      return artifact;
    } catch (e) {
      await ctx.emit({ nodeId: node.id, agent: label, level: "error", message: errMsg(e), data: { node: "error" } });
      throw e;
    }
  }

  async function runGate(node: WorkflowNode, state: S): Promise<Partial<S>> {
    const { target, maxRevisions } = REGISTRY[node.type].configSchema.parse(node.data.config) as { target: string; maxRevisions: number };
    const targetNode = nodes.get(target)!;
    let artifact = state.artifacts[target]!;
    let problems = reviewArtifact(artifact, ctx);

    for (let rev = 1; problems.length && rev <= maxRevisions; rev++) {
      await ctx.emit({
        nodeId: node.id,
        agent: "Quality Gate",
        level: "decision",
        message: `Rejected ${targetNode.data.label ?? targetNode.type}: ${problems.length} problem(s). Sending back for revision ${rev}/${maxRevisions}.`,
        data: { problems },
      });
      artifact = await exec(targetNode, state, problems, rev);
      problems = reviewArtifact(artifact, ctx);
    }

    const warnings = problems.map((p) => `Quality gate (${node.id}): ${p}`);
    await ctx.emit({
      nodeId: node.id,
      agent: "Quality Gate",
      level: problems.length ? "warn" : "decision",
      message: problems.length ? `Passing best attempt with ${problems.length} unresolved issue(s).` : "Approved.",
      data: problems.length ? { problems } : undefined,
    });
    // Gate passes the (possibly revised) artifact downstream under its own id.
    return { artifacts: { [node.id]: artifact }, warnings };
  }

  // ── compile ──
  // LangGraph's builder types node names as literals; ours are dynamic, so widen once here.
  type Builder = { addNode(n: string, fn: (s: S) => Promise<Partial<S>>): Builder; addEdge(from: string | string[], to: string): Builder; compile(): { invoke(i: Partial<S>, o: { recursionLimit: number; signal?: AbortSignal }): Promise<S> } };
  const sg = new StateGraph(State) as unknown as Builder;

  for (const node of graph.nodes) {
    sg.addNode(node.id, async (state) => (node.type === "control.qualityGate" ? runGate(node, state) : { artifacts: { [node.id]: await exec(node, state, [], 0) } }));
  }
  for (const node of graph.nodes) {
    const ins = incoming.get(node.id) ?? [];
    if (ins.length === 0) sg.addEdge(START, node.id);
    else sg.addEdge(ins.length === 1 ? ins[0]! : ins, node.id);
    if (!outgoing.get(node.id)?.length) sg.addEdge(node.id, END);
  }

  const final = await sg.compile().invoke({}, { recursionLimit: 100, signal: ctx.signal });

  const outputs = graph.nodes.flatMap((n) => {
    const a = final.artifacts[n.id];
    if (n.type !== "output.deliverable" || a?.kind !== "deliverable") return [];
    const d = a.data as { outputId: string; hash: string; anchorId?: string };
    return [{ nodeId: n.id, ...d }];
  });
  return { artifacts: final.artifacts, warnings: final.warnings, outputs };
}
