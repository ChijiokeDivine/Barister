import { z } from "zod";
import type { NodeDef, OutputContent, OutputKind, OutputSection } from "../context";
import { gather, type Bundle } from "./helpers";

const config = z.object({
  kind: z.enum(["auto", "trial_outline", "timeline", "risk_matrix", "report"]).default("auto"),
  title: z.string().max(120).optional(),
  /** Anchor the deliverable's SHA-256 on Sepolia as an immutable execution proof. Off by default: it costs gas. */
  anchor: z.boolean().default(false),
});

const cell = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Pure: bundle → deliverable. No I/O, so it's trivially testable. Operates on REDACTED data; rehydration happens after. */
export function buildOutput(b: Bundle, kind: OutputKind, title: string): OutputContent {
  const sections: OutputSection[] = [];
  const data: OutputContent["data"] = { events: b.events, contradictions: b.contradictions, questions: b.questions, riskMatrix: b.riskMatrix, text: b.text };

  if (kind === "trial_outline") {
    const cs = b.contradictions ?? [];
    sections.push({
      heading: "Key Inconsistencies",
      items: cs.length ? cs.map((c) => ({ text: `${c.title} — ${c.explanation}`, meta: `${c.severity.toUpperCase()} · ${c.category.replace(/_/g, " ")} · ${c.impeachmentValue}` })) : [{ text: "No inconsistencies identified." }],
    });
    // Preserve the model's section order (it is deliberate: foundation → pin-down → impeachment).
    const bySection = new Map<string, NonNullable<Bundle["questions"]>>();
    for (const q of b.questions ?? []) bySection.set(q.section, [...(bySection.get(q.section) ?? []), q]);
    for (const [heading, qs] of bySection) {
      sections.push({
        heading,
        items: qs.map((q, i) => ({
          text: `${i + 1}. ${q.text}`,
          meta: [q.kind.replace(/_/g, " "), q.purpose, q.exhibits.length ? `Exhibits: ${q.exhibits.join("; ")}` : ""].filter(Boolean).join(" · "),
        })),
      });
    }
  } else if (kind === "timeline") {
    sections.push({
      heading: "Chronology",
      table: {
        columns: ["Date", "Type", "Event", "Source", "Verified"],
        rows: (b.events ?? []).map((e) => [e.date ?? "undated", e.type, cell(e.description), `${e.docName}${e.page ? ` p.${e.page}` : ""}`, e.verified ? "yes" : "no"]),
      },
    });
  } else if (kind === "risk_matrix") {
    const rm = b.riskMatrix;
    if (rm?.summary) sections.push({ heading: "Summary", body: rm.summary });
    sections.push({
      heading: "Risk Matrix",
      table: {
        columns: ["Clause", "Risk", "Issue", "Playbook", "Recommendation"],
        rows: (rm?.clauses ?? []).map((c) => [c.clause, c.riskLevel, cell(c.issue), cell(c.playbookPosition), cell(c.recommendation)]),
      },
    });
    const redlines = (rm?.clauses ?? []).filter((c) => c.redline);
    if (redlines.length) sections.push({ heading: "Suggested Redlines", items: redlines.map((c) => ({ text: c.redline!, meta: c.clause })) });
  } else {
    if (b.text) sections.push({ heading: "Analysis", body: b.text });
    if (b.events?.length) sections.push({ heading: "Chronology", table: { columns: ["Date", "Event", "Source"], rows: b.events.map((e) => [e.date ?? "undated", cell(e.description), e.docName]) } });
    if (b.contradictions?.length) sections.push({ heading: "Inconsistencies", items: b.contradictions.map((c) => ({ text: `${c.title}: ${c.explanation}`, meta: c.severity })) });
    if (b.riskMatrix) sections.push({ heading: "Risks", items: b.riskMatrix.clauses.map((c) => ({ text: `${c.clause}: ${c.issue}`, meta: c.riskLevel })) });
  }
  return { kind, title, sections, data };
}

/** Picks the most advanced artifact present: questions > risk matrix > timeline > free text. */
export function inferKind(b: Bundle): OutputKind {
  if (b.questions?.length) return "trial_outline";
  if (b.riskMatrix) return "risk_matrix";
  if (b.events?.length && !b.text) return "timeline";
  return "report";
}

const TITLES: Record<OutputKind, string> = { trial_outline: "Examination Outline", timeline: "Chronological Timeline", risk_matrix: "Contract Risk Matrix", report: "Analysis Report" };

export const outputDeliverable: NodeDef<typeof config> = {
  type: "output.deliverable",
  label: "Deliverable",
  description: "Assembles the final deliverable, restores original names/dates for the attorney, saves it, and optionally anchors its hash on-chain.",
  produces: "deliverable",
  needsAny: [],
  configSchema: config,
  async run({ config, inputs, ctx, node }) {
    const b = gather(inputs);
    const kind: OutputKind = config.kind === "auto" ? inferKind(b) : config.kind;
    const built = buildOutput(b, kind, config.title ?? TITLES[kind]);
    // Rehydrate ONLY here, at the very end, and only the content the attorney sees. Nothing downstream of this
    // point ever goes back to a model.
    const content = ctx.redactor.restoreDeep(built);
    const saved = await ctx.saveOutput({ content, anchor: config.anchor });
    await ctx.emit({
      nodeId: node.id,
      agent: "Deliverable",
      level: "decision",
      message: `Saved "${content.title}" with PII restored for the attorney.${config.anchor ? " An execution proof will be anchored on Sepolia when the run completes." : ""}`,
      data: { outputId: saved.outputId, hash: saved.hash },
    });
    return { kind: "deliverable", data: { outputId: saved.outputId, hash: saved.hash, anchorId: saved.anchorId, kindOut: kind } };
  },
};
