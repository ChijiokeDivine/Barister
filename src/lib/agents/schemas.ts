/**
 * Shared artifact + workflow schemas. zod is the single source of truth: it validates LLM output, API input,
 * and (via z.toJSONSchema) is shown to the model, so the prompt and the validator can never drift apart.
 * `.describe()` text is deliberately instructional — it ends up in the model's schema.
 */
import { z } from "zod";

// ─────────────── Timeline ───────────────
export const LlmEventSchema = z.object({
  date: z.string().nullable().describe("ISO 8601: YYYY-MM-DD, or YYYY-MM / YYYY when less precise. null if the text gives no date."),
  datePrecision: z.enum(["day", "month", "year", "unknown"]),
  type: z.enum(["event", "statement", "document", "communication", "transaction", "other"]),
  description: z.string().describe("One factual sentence. Keep placeholders like [NAME_ABC123] exactly as written."),
  speaker: z.string().nullable().describe("For type=statement: who made the claim (placeholder or role). Otherwise null."),
  actors: z.array(z.string()).describe("People/entities involved, as placeholders exactly as they appear."),
  quote: z.string().describe("VERBATIM excerpt (max ~300 chars) from the source supporting this entry. Never paraphrase."),
  page: z.number().int().nullable().describe("Page number from the nearest preceding [[PAGE n]] marker, or null."),
  confidence: z.enum(["high", "medium", "low"]),
});
export const ChunkExtractionSchema = z.object({ events: z.array(LlmEventSchema) });

export type TimelineEvent = z.infer<typeof LlmEventSchema> & {
  id: string;
  docId: string;
  docName: string;
  /** true when `quote` was found verbatim in the source text (anti-hallucination check). */
  verified: boolean;
};

// ─────────────── Contradictions ───────────────
export const ContradictionSchema = z.object({
  contradictions: z.array(
    z.object({
      title: z.string().describe("Short label, e.g. 'Conflicting accounts of the March meeting'."),
      category: z.enum(["testimony_vs_testimony", "testimony_vs_document", "document_vs_document", "timeline_impossibility", "omission"]),
      severity: z.enum(["high", "medium", "low"]),
      eventIds: z.array(z.string()).min(2).describe("ids of the conflicting timeline entries — ONLY ids that appear in the input."),
      explanation: z.string().describe("Precisely what conflicts and why they cannot both be true."),
      impeachmentValue: z.string().describe("How examining counsel could use this."),
    }),
  ),
});
export type Contradiction = z.infer<typeof ContradictionSchema>["contradictions"][number] & { id: string };

// ─────────────── Examination questions ───────────────
export const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      section: z.string().describe("Topic heading this question belongs to; group related questions under the same heading."),
      kind: z.enum(["foundation", "open", "pin_down", "impeachment", "clarification", "close_the_door"]),
      text: z.string().describe("The question exactly as counsel would ask it."),
      purpose: z.string().describe("Why counsel asks this / what it locks in."),
      contradictionIds: z.array(z.string()).describe("Related contradiction ids (may be empty)."),
      eventIds: z.array(z.string()).describe("Supporting timeline entry ids (may be empty)."),
      exhibits: z.array(z.string()).describe("Document names/pages counsel should have ready."),
    }),
  ),
});
export type ExamQuestion = z.infer<typeof QuestionsSchema>["questions"][number] & { id: string };

// ─────────────── Contract risk matrix ───────────────
export const RiskMatrixSchema = z.object({
  summary: z.string(),
  clauses: z.array(
    z.object({
      clause: z.string().describe("Clause name/topic, e.g. 'Limitation of liability'."),
      location: z.string().nullable().describe("Section/page reference if known."),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
      issue: z.string(),
      playbookPosition: z.string().nullable().describe("The firm's preferred position for this clause, if a playbook rule applies."),
      recommendation: z.string(),
      redline: z.string().nullable().describe("Suggested replacement language, if useful."),
      quote: z.string().describe("VERBATIM excerpt of the clause."),
    }),
  ),
});
export type RiskMatrix = z.infer<typeof RiskMatrixSchema>;

// ─────────────── Workflow graph (React Flow compatible) ───────────────
export const NODE_TYPES = [
  "source.documents",
  "agent.timeline",
  "agent.inconsistency",
  "agent.questions",
  "agent.contractReview",
  "agent.custom",
  "control.qualityGate",
  "output.deliverable",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "id may contain letters, digits, _ and - only"),
  type: z.enum(NODE_TYPES),
  // position/data mirror React Flow's Node shape so the canvas can round-trip this JSON untouched.
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  data: z.object({ label: z.string().max(80).optional(), config: z.record(z.string(), z.unknown()).default({}) }).default({ config: {} }),
});
export const WorkflowEdgeSchema = z.object({
  id: z.string().max(130).optional(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
});
export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema).min(1).max(40),
  edges: z.array(WorkflowEdgeSchema).max(120),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export type ArtifactKind = "documents" | "timeline" | "contradictions" | "questions" | "risk_matrix" | "text" | "deliverable";
export interface Artifact {
  kind: ArtifactKind;
  data: unknown;
}
