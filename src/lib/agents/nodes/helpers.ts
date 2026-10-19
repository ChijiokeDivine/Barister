import type { Contradiction, ExamQuestion, RiskMatrix, TimelineEvent } from "../schemas";
import type { NodeInput, RedactedDoc, RunContext } from "../context";

/**
 * Artifacts accumulate: each stage carries forward what earlier stages produced
 * (questions ⊃ contradictions ⊃ events). That lets users wire a simple linear chain and still have the final
 * deliverable contain the whole analysis.
 */
export interface Bundle {
  docs?: RedactedDoc[];
  events?: TimelineEvent[];
  contradictions?: Contradiction[];
  questions?: ExamQuestion[];
  riskMatrix?: RiskMatrix;
  text?: string;
}

export function gather(inputs: NodeInput[]): Bundle {
  const out: Bundle = {};
  for (const { artifact } of inputs) {
    const d = (artifact.data ?? {}) as Bundle;
    // Keep the first non-empty value per field; later inputs only fill gaps.
    for (const k of Object.keys(d) as (keyof Bundle)[]) if (out[k] === undefined) (out as Record<string, unknown>)[k] = d[k];
  }
  return out;
}

/** Redact free text (witness names, user instructions, focus hints) before it can reach a model prompt. */
export const safeText = (ctx: RunContext, s: string | undefined): string | undefined => (s ? ctx.redactor.redact(s).text : undefined);

/** One compact line per event, used wherever events are shown to a model. */
export function fmtEvent(e: TimelineEvent): string {
  const who = e.type === "statement" && e.speaker ? ` by ${e.speaker}` : "";
  return `${e.id} | ${e.date ?? "undated"} | ${e.type}${who} | ${e.description} | "${e.quote.replace(/\s+/g, " ").slice(0, 240)}" | ${e.docName}${e.page ? ` p.${e.page}` : ""}`;
}

export const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;
