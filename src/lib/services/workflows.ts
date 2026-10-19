import { z } from "zod";
import { REGISTRY, nodeCatalog } from "../agents/registry";
import { WorkflowGraphSchema, type WorkflowGraph } from "../agents/schemas";
import { validateWorkflow } from "../agents/validate";
import { badRequest, notFound } from "../errors";
import { newId, nowIso } from "../ids";
import { sealedRepo } from "../store/repo";

export const WorkflowInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  graph: WorkflowGraphSchema,
});
export type Workflow = z.infer<typeof WorkflowInputSchema> & { id: string; createdAt: string; updatedAt: string };

export const workflows = sealedRepo<Workflow>("workflows");

/** Saving only requires a structurally valid graph (drafts may be incomplete); running re-validates fully. */
function checkSavable(graph: WorkflowGraph) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) throw badRequest("Duplicate node ids");
  for (const e of graph.edges) if (!ids.has(e.source) || !ids.has(e.target)) throw badRequest(`Edge ${e.source} → ${e.target} references a missing node`);
}

export async function createWorkflow(input: unknown): Promise<Workflow> {
  const parsed = WorkflowInputSchema.parse(input);
  checkSavable(parsed.graph);
  const now = nowIso();
  return workflows.put({ ...parsed, id: newId("wf"), createdAt: now, updatedAt: now });
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const w = await workflows.get(id);
  if (!w) throw notFound("Workflow");
  return w;
}

export async function updateWorkflow(id: string, input: unknown): Promise<Workflow> {
  const cur = await getWorkflow(id);
  const parsed = WorkflowInputSchema.partial().parse(input);
  if (parsed.graph) checkSavable(parsed.graph);
  return workflows.put({ ...cur, ...parsed, updatedAt: nowIso() });
}

// ───────────── Layout ─────────────
/** Longest-path layering → readable left-to-right canvas positions. We never trust model-provided coordinates. */
export function autoLayout(graph: WorkflowGraph): WorkflowGraph {
  const level = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < graph.nodes.length; i++) {
    for (const e of graph.edges) level.set(e.target, Math.max(level.get(e.target) ?? 0, (level.get(e.source) ?? 0) + 1));
  }
  const rows = new Map<number, number>();
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const l = level.get(n.id) ?? 0;
      const r = rows.get(l) ?? 0;
      rows.set(l, r + 1);
      return { ...n, position: { x: l * 300, y: r * 160 } };
    }),
    edges: graph.edges.map((e) => ({ ...e, id: e.id ?? `e_${e.source}_${e.target}` })),
  };
}

const node = (id: string, type: WorkflowGraph["nodes"][number]["type"], config: Record<string, unknown> = {}, label?: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label, config } });

// ───────────── Templates ─────────────
export const TEMPLATES: { id: string; name: string; description: string; graph: WorkflowGraph }[] = [
  {
    id: "deposition_prep",
    name: "Deposition Question Prep",
    description: "Ingests discovery and transcripts → chronology → contradictions → examination outline, with a quality gate.",
    graph: autoLayout({
      nodes: [
        node("docs", "source.documents"),
        node("timeline", "agent.timeline"),
        node("inconsistencies", "agent.inconsistency"),
        node("questions", "agent.questions", { style: "neutral", maxQuestions: 60 }),
        node("gate", "control.qualityGate", { target: "questions", maxRevisions: 2 }),
        node("out", "output.deliverable", { kind: "trial_outline", title: "Deposition Examination Outline", anchor: true }),
      ],
      edges: [
        { source: "docs", target: "timeline" },
        { source: "timeline", target: "inconsistencies" },
        { source: "inconsistencies", target: "questions" },
        { source: "questions", target: "gate" },
        { source: "gate", target: "out" },
      ],
    }),
  },
  {
    id: "contract_risk_review",
    name: "Contract Risk Review",
    description: "Reviews contracts clause-by-clause against the firm playbook and outputs a risk matrix with redlines.",
    graph: autoLayout({
      nodes: [node("docs", "source.documents"), node("review", "agent.contractReview"), node("gate", "control.qualityGate", { target: "review", maxRevisions: 1 }), node("out", "output.deliverable", { kind: "risk_matrix", title: "Contract Risk Matrix" })],
      edges: [{ source: "docs", target: "review" }, { source: "review", target: "gate" }, { source: "gate", target: "out" }],
    }),
  },
  {
    id: "chronology_only",
    name: "Chronology Builder",
    description: "Just the sourced timeline — fast and cheap.",
    graph: autoLayout({
      nodes: [node("docs", "source.documents"), node("timeline", "agent.timeline"), node("out", "output.deliverable", { kind: "timeline", title: "Chronological Timeline" })],
      edges: [{ source: "docs", target: "timeline" }, { source: "timeline", target: "out" }],
    }),
  },
];

// ───────────── Chat → workflow generation ─────────────
export const GeneratedWorkflowSchema = z.object({
  name: z.string().max(120),
  description: z.string().max(1000),
  graph: WorkflowGraphSchema,
});

export function generatorSystemPrompt(): string {
  const catalog = nodeCatalog()
    .map((n) => `- ${n.type}: ${n.description} | produces: ${n.produces} | needs one of: ${n.needsAny.join(", ") || "nothing"} | config: ${JSON.stringify(Object.keys((n.configSchema as { properties?: object }).properties ?? {}))}`)
    .join("\n");
  const example = JSON.stringify({ name: TEMPLATES[0]!.name, description: TEMPLATES[0]!.description, graph: { nodes: TEMPLATES[0]!.graph.nodes.map(({ position: _p, ...n }) => n), edges: TEMPLATES[0]!.graph.edges.map(({ source, target }) => ({ source, target })) } });
  return `You design legal workflows as node graphs for a multi-agent platform. Translate the user's request into a graph using ONLY these node types:
${catalog}

Rules:
- Exactly one or more "source.documents" start the graph; every graph ends in an "output.deliverable".
- Edges must connect compatible artifacts (a node's "needs" must be satisfied by an upstream node's "produces").
- Add a "control.qualityGate" after "agent.questions" or "agent.contractReview"; its config.target is the id of the node directly before it, and that node must connect ONLY to the gate.
- Use "agent.custom" (config: name, instruction, tier) for any bespoke step the standard agents don't cover.
- Node ids: short, unique, letters/digits/underscores. No cycles. Omit positions (they are laid out automatically).
- Keep it as simple as the request allows.

Example for "prepare deposition questions": ${example}`;
}

/** Cheap structural check used by the repair loop in the generator. */
export function graphProblems(g: WorkflowGraph): string[] {
  return validateWorkflow(g).issues.map((i) => `${i.nodeId ? `[${i.nodeId}] ` : ""}${i.message}`);
}

export const isKnownType = (t: string) => t in REGISTRY;
