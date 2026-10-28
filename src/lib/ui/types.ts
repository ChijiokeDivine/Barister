import type { LogEntry, OutputContent, OutputKind } from "@/lib/agents/context";
import type { NodeType, WorkflowGraph } from "@/lib/agents/schemas";
import type { AnchorKind } from "@/lib/services/anchors";
import type { RunStatus } from "@/lib/services/runs";

/** Shapes returned by the JSON API (records minus graph snapshots / large blobs). */

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRecord extends WorkflowSummary {
  graph: WorkflowGraph;
}

export interface RunSummary {
  id: string;
  workflowId: string | null;
  workflowName: string;
  caseId: string | null;
  status: RunStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  heartbeatAt?: string;
  attempts: number;
  error?: string;
  warnings: string[];
  outputs: { nodeId: string; outputId: string; hash: string }[];
  models: string[];
  proofAnchorId?: string;
  proofError?: string;
  resumable?: boolean;
}

export interface RunDetail extends RunSummary {
  graph: WorkflowGraph;
  docIds?: string[];
  instructions?: string;
}

export interface OutputSummary {
  id: string;
  runId: string;
  caseId: string | null;
  kind: OutputKind;
  title: string;
  hash: string;
  createdAt: string;
}

export interface OutputDetail extends OutputSummary {
  content: OutputContent;
  integrity: { id: string; expected: string; actual: string; intact: boolean };
}

export interface NodeCatalogItem {
  type: NodeType;
  label: string;
  description: string;
  produces: string;
  needsAny: string[];
  isSource: boolean;
  configSchema: JsonSchema;
}

export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  order: string[];
}

export interface RunLogEntry extends LogEntry {}

export interface RunLogPage {
  entries: RunLogEntry[];
  next: number;
  status: RunStatus;
}

export interface AgentFeed {
  active: (RunSummary & { stalled: boolean; nodeCount: number; recent: RunLogEntry[] })[];
  recentFinished: RunSummary[];
}

export interface ConversationSummary {
  id: string;
  caseId: string | null;
  title: string;
  docIds: string[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  role: "user" | "assistant";
  content: string;
  ts: string;
  workflow?: { name: string; description: string; graph: WorkflowGraph };
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessageDTO[];
}

export interface AnchorSummary {
  id: string;
  kind: AnchorKind;
  refId: string | null;
  hash: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  from?: string;
  chainId: number;
  blockNumber?: number;
  blockTimestamp?: string;
  explorerUrl?: string;
  error?: string;
  createdAt: string;
}

export interface AuditPayload {
  explorer: string;
  network: string;
  anchors: AnchorSummary[];
}

export interface Verification {
  hash: string;
  verified: boolean;
  anchors: { id: string; kind: AnchorKind; txHash?: string; explorerUrl?: string; onChain: boolean; blockNumber?: number; blockTimestamp?: string; reason?: string }[];
}

export interface DashboardSummary {
  counts: {
    cases: number;
    openCases: number;
    documents: number;
    workflows: number;
    outputs: number;
    runsRunning: number;
    runsFailed: number;
    piiRedactions: number;
    anchorsConfirmed: number;
    anchorsPending: number;
  };
  recentRuns: RunSummary[];
  recentOutputs: OutputSummary[];
}
