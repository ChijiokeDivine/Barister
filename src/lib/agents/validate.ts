import { REGISTRY } from "./registry";
import type { ArtifactKind, WorkflowGraph } from "./schemas";

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

/**
 * Static checks run BEFORE any LLM call, so a bad canvas fails in milliseconds with a pointer to the broken node
 * instead of halfway through an expensive run. Returns issues + a topological order (gates excluded from cycles).
 */
export function validateWorkflow(g: WorkflowGraph): { issues: ValidationIssue[]; order: string[] } {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) issues.push({ nodeId: n.id, message: `Duplicate node id "${n.id}"` });
    ids.add(n.id);
  }
  const byId = new Map(g.nodes.map((n) => [n.id, n]));

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      issues.push({ message: `Edge ${e.source} → ${e.target} references a missing node` });
      continue;
    }
    if (e.source === e.target) issues.push({ nodeId: e.source, message: "A node cannot connect to itself" });
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]);
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
  }

  // Config + wiring rules per node.
  const kindOf = (id: string): ArtifactKind | "passthrough" => REGISTRY[byId.get(id)!.type].produces;
  for (const n of g.nodes) {
    const def = REGISTRY[n.type];
    const cfg = def.configSchema.safeParse(n.data.config ?? {});
    if (!cfg.success) issues.push({ nodeId: n.id, message: `Invalid config: ${cfg.error.issues.map((i) => `${i.path.join(".") || "config"} ${i.message}`).join("; ")}` });

    const ins = incoming.get(n.id) ?? [];
    if (def.isSource && ins.length) issues.push({ nodeId: n.id, message: `${def.label} is a source and cannot have inputs` });
    if (def.needsAny.length) {
      // Gates are transparent: look through them to the artifact kind they pass along.
      const resolve = (id: string): ArtifactKind | null => {
        const k = kindOf(id);
        if (k !== "passthrough") return k;
        const up = incoming.get(id)?.[0];
        return up ? resolve(up) : null;
      };
      const kinds = ins.map(resolve);
      if (!kinds.some((k) => k && def.needsAny.includes(k))) {
        issues.push({ nodeId: n.id, message: `${def.label} needs an input of type ${def.needsAny.join(" or ")}${ins.length ? " (connected inputs don't provide it)" : " but has no inputs"}` });
      }
    }
    if (n.type === "control.qualityGate") {
      const target = (n.data.config as { target?: string }).target;
      if (!target || !ins.includes(target)) issues.push({ nodeId: n.id, message: "Quality Gate `target` must be a node directly connected into the gate" });
      else if (REGISTRY[byId.get(target)!.type].isSource) issues.push({ nodeId: n.id, message: "A gate cannot review a source node" });
      // The gate re-runs its target on failure; if the target also fed other nodes they'd have consumed the rejected draft.
      else if ((outgoing.get(target)?.length ?? 0) !== 1) issues.push({ nodeId: n.id, message: "The node a Quality Gate reviews must connect ONLY to that gate" });
    }
    if (n.type === "output.deliverable" && (outgoing.get(n.id)?.length ?? 0) > 0) issues.push({ nodeId: n.id, message: "Deliverable must be the end of a branch" });
  }

  // Cycle check (Kahn). User-drawn edges must form a DAG; gate retry loops are added by the engine, not drawn.
  const indeg = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const [t, ss] of incoming) indeg.set(t, ss.length);
  const queue = g.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of outgoing.get(id) ?? []) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  if (order.length !== g.nodes.length) issues.push({ message: "The workflow contains a cycle. Remove the looping connection (use a Quality Gate for retry loops)." });

  if (!g.nodes.some((n) => n.type === "output.deliverable")) issues.push({ message: "Add a Deliverable node so the run produces a saved output" });
  if (!g.nodes.some((n) => REGISTRY[n.type].isSource)) issues.push({ message: "Add a Documents source node" });
  return { issues, order };
}
