import { z } from "zod";
import { sha256Hex } from "../../hash";
import { mapSettled } from "../../util";
import type { NodeDef } from "../context";
import { INCONSISTENCY_SYSTEM, PROMPT_VERSION } from "../prompts";
import { ContradictionSchema, type Contradiction, type TimelineEvent } from "../schemas";
import { fmtEvent, gather, safeText, SEVERITY_RANK } from "./helpers";

const config = z.object({
  focus: z.string().max(500).optional(),
  /** Drop findings below this severity. */
  minSeverity: z.enum(["low", "medium", "high"]).default("low"),
});

// The timeline is far smaller than the source documents, so one batch normally covers a whole case.
const BATCH_CHARS = 450_000;

function batchEvents(events: TimelineEvent[]): TimelineEvent[][] {
  const batches: TimelineEvent[][] = [];
  let cur: TimelineEvent[] = [];
  let size = 0;
  for (const e of events) {
    const len = fmtEvent(e).length + 1;
    if (size + len > BATCH_CHARS && cur.length) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(e);
    size += len;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export const inconsistencyAgent: NodeDef<typeof config> = {
  type: "agent.inconsistency",
  label: "Inconsistency Analyzer",
  description: "Cross-references statements and documents in the timeline to find contradictions, impossibilities and omissions.",
  produces: "contradictions",
  needsAny: ["timeline"],
  configSchema: config,
  async run({ config, inputs, ctx, node }) {
    const { events = [] } = gather(inputs);
    if (events.length < 2) {
      await ctx.emit({ nodeId: node.id, agent: "Inconsistency Analyzer", level: "warn", message: "Fewer than 2 timeline events — nothing to cross-reference." });
      return { kind: "contradictions", data: { events, contradictions: [] } };
    }

    const focus = safeText(ctx, config.focus ?? ctx.runInput.instructions);
    const batches = batchEvents(events);
    if (batches.length > 1) {
      // Cross-batch pairs are not compared. Surfacing this is more honest than implying full coverage.
      await ctx.emit({
        nodeId: node.id,
        agent: "Inconsistency Analyzer",
        level: "warn",
        message: `Timeline too large for one pass; analysing ${batches.length} date-ordered batches. Contradictions between events in different batches may be missed.`,
      });
    }

    const ids = new Set(events.map((e) => e.id));
    const settled = await mapSettled(batches, 2, async (batch, i) => {
      const body = batch.map(fmtEvent).join("\n");
      const key = `inc:${await sha256Hex(`${PROMPT_VERSION}|${focus ?? ""}|${body}`)}`;
      const cached = await ctx.cacheGet<z.infer<typeof ContradictionSchema>>(key);
      if (cached) return cached.contradictions;
      const out = await ctx.llm.json(
        ContradictionSchema,
        {
          system: INCONSISTENCY_SYSTEM(focus),
          messages: [{ role: "user", content: `CHRONOLOGY (id | date | type | description | quote | source):\n${body}` }],
          temperature: 0.1,
          maxOutputTokens: 16_000,
        },
        { tier: "long", where: `inconsistency:${i}` },
      );
      await ctx.cachePut(key, out);
      return out.contradictions;
    });

    const failed = settled.filter((s) => !s.ok);
    if (failed.length) throw new Error(`Inconsistency analysis failed on ${failed.length}/${batches.length} batch(es): ${(failed[0] as { error: Error }).error.message}`);

    const found = settled.flatMap((s) => (s.ok ? s.value : []));

    // Validate model output against reality: every cited event must exist. Hallucinated references are dropped.
    let droppedRefs = 0;
    const seen = new Set<string>();
    const valid = found.flatMap((c) => {
      const eventIds = [...new Set(c.eventIds.filter((id) => ids.has(id)))];
      droppedRefs += c.eventIds.length - eventIds.length;
      if (eventIds.length < 2) return [];
      const sig = [...eventIds].sort().join(",");
      if (seen.has(sig)) return []; // same set of events flagged twice (e.g. overlapping batches)
      seen.add(sig);
      return [{ ...c, eventIds }];
    });

    const min = { low: 2, medium: 1, high: 0 }[config.minSeverity];
    const contradictions: Contradiction[] = valid
      .filter((c) => SEVERITY_RANK[c.severity] <= min)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .map((c, i) => ({ ...c, id: `c_${i + 1}` }));

    await ctx.emit({
      nodeId: node.id,
      agent: "Inconsistency Analyzer",
      level: "decision",
      message: `Found ${contradictions.length} contradiction(s) (${contradictions.filter((c) => c.severity === "high").length} high). Discarded ${found.length - valid.length} finding(s) with invalid/duplicate evidence and ${droppedRefs} unknown event reference(s).`,
    });
    return { kind: "contradictions", data: { events, contradictions } };
  },
};
