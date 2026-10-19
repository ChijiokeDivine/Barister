/**
 * Contracts between the engine and the outside world. The engine only sees these interfaces, never the database
 * or HTTP layer — so it can be unit-tested with in-memory fakes and reused by any trigger (route, cron, chat).
 */
import type { z } from "zod";
import type { LLMRouter } from "../llm/router";
import type { Redactor } from "../redact";
import type { Artifact, ArtifactKind, Contradiction, ExamQuestion, RiskMatrix, TimelineEvent, WorkflowNode } from "./schemas";

export interface RedactedDoc {
  id: string;
  name: string;
  /** ALREADY redacted. Raw text never enters the engine. */
  text: string;
  pages: number | null;
}

export interface LogEntry {
  ts: string;
  runId: string;
  nodeId?: string;
  agent: string;
  /** decision = a reasoned choice worth showing in the "thought process" panel (not raw model chain-of-thought). */
  level: "info" | "decision" | "warn" | "error";
  message: string;
  data?: unknown;
}

export interface PlaybookRule {
  id: string;
  clause: string;
  preferred: string;
  fallback?: string;
  redLine?: string;
}

export type OutputKind = "trial_outline" | "timeline" | "risk_matrix" | "report";

export interface OutputSection {
  heading: string;
  body?: string;
  table?: { columns: string[]; rows: string[][] };
  items?: { text: string; meta?: string }[];
}
export interface OutputContent {
  kind: OutputKind;
  title: string;
  sections: OutputSection[];
  /** Raw structured data, so the UI can render richer views than the flattened sections. */
  data: { events?: TimelineEvent[]; contradictions?: Contradiction[]; questions?: ExamQuestion[]; riskMatrix?: RiskMatrix; text?: string };
}

export interface RunContext {
  runId: string;
  caseId: string | null;
  redactor: Redactor;
  llm: LLMRouter;
  runInput: { docIds?: string[]; instructions?: string };
  playbook: PlaybookRule[];
  signal?: AbortSignal;

  emit(entry: Omit<LogEntry, "ts" | "runId">): Promise<void>;
  /** Durable per-run cache (sealed). Lets a timed-out run resume without redoing finished LLM work. */
  cacheGet<T>(key: string): Promise<T | null>;
  cachePut(key: string, value: unknown): Promise<void>;
  /** Returns documents already redacted for the matter's vault. */
  loadDocuments(docIds?: string[]): Promise<RedactedDoc[]>;
  /** Persist a finished (already rehydrated) deliverable; optionally anchor its hash on-chain. */
  saveOutput(input: { content: OutputContent; anchor: boolean }): Promise<{ outputId: string; hash: string; anchorId?: string }>;
}

export interface NodeInput {
  nodeId: string;
  artifact: Artifact;
}

export interface NodeRunArgs<C> {
  node: WorkflowNode;
  config: C;
  inputs: NodeInput[];
  /** Reviewer feedback from a quality gate when this node is being re-run. */
  feedback: string[];
  attempt: number;
  ctx: RunContext;
}

export interface NodeDef<S extends z.ZodType = z.ZodType> {
  type: WorkflowNodeType;
  label: string;
  description: string;
  produces: ArtifactKind | "passthrough";
  /** At least one direct input of one of these kinds must be wired in ([] = no requirement). */
  needsAny: ArtifactKind[];
  /** Does the node accept no incoming edges (a pipeline source)? */
  isSource?: boolean;
  configSchema: S;
  run(args: NodeRunArgs<z.infer<S>>): Promise<Artifact>;
}

export type WorkflowNodeType = WorkflowNode["type"];
