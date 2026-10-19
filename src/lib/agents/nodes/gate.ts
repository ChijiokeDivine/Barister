import { z } from "zod";
import { jaccard } from "../../util";
import type { RunContext } from "../context";
import type { NodeDef } from "../context";
import type { Artifact } from "../schemas";
import type { Bundle } from "./helpers";

const config = z.object({
  /** id of the node whose output is reviewed and re-run on failure. */
  target: z.string().min(1),
  maxRevisions: z.number().int().min(0).max(4).default(2),
});

/**
 * Deterministic quality checks (no extra LLM call: cheap, repeatable, and impossible to "talk around").
 * Returns human-readable problems that are fed back to the target node as revision instructions.
 */
export function reviewArtifact(artifact: Artifact, ctx: RunContext): string[] {
  const d = (artifact.data ?? {}) as Bundle;
  const problems: string[] = [];

  if (artifact.kind === "questions") {
    const qs = d.questions ?? [];
    if (!qs.length) problems.push("No questions were produced.");
    const eventIds = new Set((d.events ?? []).map((e) => e.id));
    const cIds = new Set((d.contradictions ?? []).map((c) => c.id));

    const bad = qs.filter((q) => !q.text.trim().endsWith("?"));
    if (bad.length) problems.push(`${bad.length} item(s) are not phrased as questions (e.g. ${bad[0]!.id}). Every "text" must be a question ending in "?".`);

    // Every high-severity contradiction must be exercised by at least one question — that's the point of the exercise.
    const covered = new Set(qs.flatMap((q) => q.contradictionIds));
    const missing = (d.contradictions ?? []).filter((c) => c.severity === "high" && !covered.has(c.id));
    if (missing.length) problems.push(`No question addresses high-severity contradiction(s): ${missing.map((c) => c.id).join(", ")}. Add pin-down and impeachment questions for each.`);

    const ungrounded = qs.filter((q) => q.kind === "impeachment" && !q.eventIds.some((id) => eventIds.has(id)) && !q.contradictionIds.some((id) => cIds.has(id)));
    if (ungrounded.length) problems.push(`${ungrounded.length} impeachment question(s) cite no supporting event or contradiction (e.g. ${ungrounded[0]!.id}). Ground each in evidence.`);

    // Impeachment before pin-down gives the witness a chance to explain away the contradiction.
    const sections = new Map<string, string[]>();
    for (const q of qs) sections.set(q.section, [...(sections.get(q.section) ?? []), q.kind]);
    const misordered = [...sections].filter(([, kinds]) => kinds.includes("impeachment") && kinds.indexOf("impeachment") < (kinds.indexOf("pin_down") === -1 ? Infinity : kinds.indexOf("pin_down")));
    if (misordered.length) problems.push(`In section(s) ${misordered.map(([s]) => `"${s}"`).join(", ")} impeachment comes before the witness is pinned down. Pin down the account first.`);

    const dupes = qs.filter((q, i) => qs.slice(0, i).some((o) => jaccard(o.text, q.text) > 0.9));
    if (dupes.length) problems.push(`${dupes.length} near-duplicate question(s) (e.g. ${dupes[0]!.id}). Remove repetition.`);

    // Defence in depth: the privacy guard should already have prevented this.
    if (qs.some((q) => ctx.redactor.containsRaw(q.text))) problems.push("A question contains unredacted personal data. Use the placeholder tokens only.");
  }

  if (artifact.kind === "risk_matrix") {
    const clauses = d.riskMatrix?.clauses ?? [];
    if (!clauses.length) problems.push("No clauses were analysed.");
    const noRec = clauses.filter((c) => !c.recommendation.trim());
    if (noRec.length) problems.push(`${noRec.length} clause(s) lack a recommendation.`);
  }

  if (artifact.kind === "timeline" && !(d.events ?? []).length) problems.push("The timeline is empty.");
  return problems;
}

/**
 * A reviewer in the loop. The engine compiles this into a LangGraph conditional edge: on problems it routes BACK
 * to `target` with the feedback attached, up to `maxRevisions` times, then lets the best attempt through with
 * warnings (never blocks the attorney from getting a result). The routing itself lives in engine.ts.
 */
export const qualityGate: NodeDef<typeof config> = {
  type: "control.qualityGate",
  label: "Quality Gate",
  description: "Reviews the previous step's output; sends it back with feedback if it fails checks (grounding, coverage, ordering).",
  produces: "passthrough",
  needsAny: [],
  configSchema: config,
  // The engine special-cases gates (it needs state + routing); run() is only the pass-through fallback.
  async run() {
    throw new Error("control.qualityGate is executed by the engine");
  },
};
