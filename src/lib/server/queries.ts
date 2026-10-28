import type { ActivityItem, Matter, RecentThread, Space } from "@/components/dashboard/types";
import type { ModelOption } from "@/components/dashboard/types";
import { nodeCatalog } from "@/lib/agents/registry";
import { env } from "@/lib/env";
import { hashJSON } from "@/lib/hash";
import { listAnchors } from "@/lib/services/anchors";
import { cases, type Case } from "@/lib/services/cases";
import { conversations, type Conversation } from "@/lib/services/chat";
import { documents, type DocumentRecord, listDocuments } from "@/lib/services/documents";
import { getOutput, outputs, type OutputRecord } from "@/lib/services/outputs";
import { getLogTail, getLogs, getRun, isStale, listRuns, runs, type RunRecord } from "@/lib/services/runs";
import { getSettings } from "@/lib/services/settings";
import { getSystemStatus } from "@/lib/services/system";
import { TEMPLATES, workflows, type Workflow } from "@/lib/services/workflows";
import { caseTitle, matterNumber, toMatter, toSpace } from "@/lib/ui/matter";
import { relativeTime, titleCase } from "@/lib/ui/format";
import type {
  AgentFeed,
  AnchorSummary,
  ConversationSummary,
  NodeCatalogItem,
  OutputSummary,
  RunDetail,
  RunLogEntry,
  RunSummary,
  WorkflowSummary,
} from "@/lib/ui/types";

/** The API strips graph snapshots from lists; these helpers mirror that contract for server-rendered pages. */
export const toRunSummary = ({ graph: _graph, ...r }: RunRecord): RunSummary => r;
export const toWorkflowSummary = ({ graph, ...w }: Workflow): WorkflowSummary => ({ ...w, nodeCount: graph.nodes.length });
export const toOutputSummary = ({ ...o }: OutputRecord): OutputSummary => o;
export const toConversationSummary = ({ messages, ...c }: Conversation): ConversationSummary => ({ ...c, messageCount: messages.length });

export function modelOptions(): ModelOption[] {
  const e = env();
  const options: ModelOption[] = [{ value: "auto", label: "Auto routing" }];
  if (e.GEMINI_API_KEY) options.push({ value: "long", label: `Gemini · ${e.GEMINI_MODEL}` });
  if (e.GROQ_API_KEY) options.push({ value: "fast", label: `Groq · ${e.GROQ_MODEL}` });
  return options;
}

export function threadOf(c: Conversation): RecentThread {
  return { id: c.id, title: c.title, href: `/chat/${c.id}`, dot: c.caseId ? "violet" : "blue" };
}

export function activityFrom(runList: RunRecord[], docs: DocumentRecord[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const r of runList.slice(0, 3)) {
    items.push({
      id: `run-${r.id}`,
      text: `${r.workflowName} · ${r.status === "running" ? "running" : r.status === "succeeded" ? "completed" : r.status}`,
      meta: `${r.outputs.length} output${r.outputs.length === 1 ? "" : "s"} · ${relativeTime(r.finishedAt ?? r.startedAt ?? r.createdAt)}`,
      kind: "agents",
    });
  }
  for (const d of docs.slice(0, 2)) {
    items.push({
      id: `doc-${d.id}`,
      text: `${d.name} added to the vault`,
      meta: `${d.pages ? `${d.pages} pages · ` : ""}${relativeTime(d.createdAt)}`,
      kind: "files",
    });
  }
  return items.slice(0, 5);
}

export interface WorkspaceNav {
  matters: Matter[];
  spaces: Space[];
  recents: RecentThread[];
  pinned: RecentThread[];
}

/** Everything the sidebar needs: matters, spaces, and the most recent conversations. */
export async function getWorkspaceNav(): Promise<WorkspaceNav> {
  const [cs, convs] = await Promise.all([cases.list(), conversations.list()]);
  const matters = cs.map(toMatter);
  return {
    matters,
    spaces: cs.map(toSpace),
    recents: convs.slice(0, 6).map(threadOf),
    pinned: convs.slice(0, 1).map(threadOf),
  };
}

export interface ChatSetup {
  matters: Matter[];
  models: ModelOption[];
  recents: ConversationSummary[];
}

export async function getChatSetup(): Promise<ChatSetup> {
  const [cs, convs] = await Promise.all([cases.list(), conversations.list()]);
  return { matters: cs.map(toMatter), models: modelOptions(), recents: convs.slice(0, 8).map(toConversationSummary) };
}

export async function getConversationPage(id: string) {
  const conversation = await conversations.get(id);
  if (!conversation) return null;
  const record = conversation.caseId ? await cases.get(conversation.caseId) : null;
  return {
    conversation: { ...conversation, messageCount: conversation.messages.length },
    matter: record ? toMatter(record) : null,
  };
}

export interface DashboardData {
  matters: Matter[];
  models: ModelOption[];
  recent: { runs: RunSummary[]; outputs: OutputSummary[] };
  counts: { matters: number; documents: number; workflows: number; outputs: number; activeRuns: number };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [cs, docs, wfs, runList, outs] = await Promise.all([cases.list(), documents.list(), workflows.list(), runs.list(), outputs.list()]);
  return {
    matters: cs.map(toMatter),
    models: modelOptions(),
    recent: { runs: runList.slice(0, 4).map(toRunSummary), outputs: outs.slice(0, 4).map(toOutputSummary) },
    counts: {
      matters: cs.length,
      documents: docs.length,
      workflows: wfs.length,
      outputs: outs.length,
      activeRuns: runList.filter((r) => r.status === "running" || r.status === "queued").length,
    },
  };
}

export interface CaseWorkspace {
  record: Case;
  matter: Matter;
  title: string;
  documents: DocumentRecord[];
  runs: RunSummary[];
  outputs: OutputSummary[];
  workflows: WorkflowSummary[];
  conversations: ConversationSummary[];
  anchors: AnchorSummary[];
  vaultCount: number;
  redactions: number;
  activity: ActivityItem[];
  activeRunCount: number;
}

export async function getCaseWorkspace(id: string): Promise<CaseWorkspace | null> {
  const record = await cases.get(id);
  if (!record) return null;
  const [docs, runList, outList, wfList, convList, anchorList] = await Promise.all([
    listDocuments(id),
    listRuns({ caseId: id }),
    outputs.list(),
    workflows.list(),
    conversations.list(),
    listAnchors({ refresh: false }),
  ]);
  const docIds = new Set(docs.map((d) => d.id));
  const runIds = new Set(runList.map((r) => r.id));
  return {
    record,
    matter: toMatter(record),
    title: caseTitle(record),
    documents: docs,
    runs: runList.map(toRunSummary),
    outputs: outList.filter((o) => o.caseId === id).map(toOutputSummary),
    workflows: wfList.map(toWorkflowSummary),
    conversations: convList.filter((c) => c.caseId === id).map(toConversationSummary),
    anchors: anchorList.filter((a) => (a.kind === "document" && docIds.has(a.refId ?? "")) || (a.kind === "run_proof" && runIds.has(a.refId ?? ""))),
    vaultCount: docs.reduce((n, d) => n + Object.keys(d.stats).length, 0),
    redactions: docs.reduce((n, d) => n + Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0), 0),
    activity: activityFrom(runList, docs),
    activeRunCount: runList.filter((r) => r.status === "running" || r.status === "queued").length,
  };
}

export interface VaultData {
  documents: DocumentRecord[];
  matters: Matter[];
  anchors: AnchorSummary[];
  counts: { documents: number; redactions: number; anchored: number; pages: number };
}

export async function getVaultData(caseId?: string | null): Promise<VaultData> {
  const [docs, cs, anchorList] = await Promise.all([listDocuments(caseId), cases.list(), listAnchors({ refresh: false })]);
  return {
    documents: docs,
    matters: cs.map(toMatter),
    anchors: anchorList,
    counts: {
      documents: docs.length,
      redactions: docs.reduce((n, d) => n + Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0), 0),
      anchored: docs.filter((d) => d.anchorId).length,
      pages: docs.reduce((n, d) => n + (d.pages ?? 0), 0),
    },
  };
}

export async function getDocumentPage(id: string) {
  const doc = await documents.get(id);
  if (!doc) return null;
  const [record, anchorList] = await Promise.all([doc.caseId ? cases.get(doc.caseId) : Promise.resolve(null), listAnchors({ refresh: false })]);
  return {
    doc,
    matter: record ? toMatter(record) : null,
    caseTitle: record ? caseTitle(record) : "Unassigned",
    anchor: anchorList.find((a) => a.id === doc.anchorId) ?? null,
  };
}

export interface WorkflowsData {
  workflows: WorkflowSummary[];
  templates: typeof TEMPLATES;
  runs: RunSummary[];
  matters: Matter[];
  outputs: OutputSummary[];
}

export async function getWorkflowsData(): Promise<WorkflowsData> {
  const [wfList, runList, cs, outList] = await Promise.all([workflows.list(), runs.list(), cases.list(), outputs.list()]);
  return { workflows: wfList.map(toWorkflowSummary), templates: TEMPLATES, runs: runList.slice(0, 8).map(toRunSummary), matters: cs.map(toMatter), outputs: outList.slice(0, 8).map(toOutputSummary) };
}

export interface WorkflowPageData {
  workflow: Workflow | null;
  matters: Matter[];
  catalog: NodeCatalogItem[];
  recentRuns: RunSummary[];
}

export async function getWorkflowPage(id?: string): Promise<WorkflowPageData> {
  const [wf, cs, runList] = await Promise.all([id ? workflows.get(id) : null, cases.list(), runs.list()]);
  return {
    workflow: wf,
    matters: cs.map(toMatter),
    catalog: nodeCatalog() as unknown as NodeCatalogItem[],
    recentRuns: runList.filter((r) => r.workflowId === id).slice(0, 6).map(toRunSummary),
  };
}

export interface AgentsData {
  feed: AgentFeed;
  matters: Matter[];
  outputs: OutputSummary[];
}

export async function getAgentsData(): Promise<AgentsData> {
  const all = await listRuns();
  const active = all.filter((r) => r.status === "running" || r.status === "queued").slice(0, 10);
  const [cs, outList] = await Promise.all([cases.list(), outputs.list()]);
  return {
    matters: cs.map(toMatter),
    outputs: outList.slice(0, 8).map(toOutputSummary),
    feed: {
      active: await Promise.all(
        active.map(async (r) => ({
          ...toRunSummary(r),
          stalled: isStale(r),
          nodeCount: r.graph.nodes.length,
          recent: (await getLogTail(r.id, 40)).filter((l) => l.level !== "info" || l.data).slice(-8),
        })),
      ),
      recentFinished: all.filter((r) => !["running", "queued"].includes(r.status)).slice(0, 12).map(toRunSummary),
    },
  };
}

export interface RunPageData {
  run: RunDetail;
  logs: RunLogEntry[];
  cursor: number;
  matter: Matter | null;
  outputs: OutputSummary[];
  workflow: WorkflowSummary | null;
}

export async function getRunPage(id: string): Promise<RunPageData> {
  const run = await getRun(id);
  const [logPage, cs, outList, wf] = await Promise.all([
    getLogs(id, 0, 500),
    run.caseId ? cases.get(run.caseId) : Promise.resolve(null),
    outputs.list(),
    run.workflowId ? workflows.get(run.workflowId) : Promise.resolve(null),
  ]);
  return {
    run: { ...run, resumable: run.status === "failed" || run.status === "cancelled" || isStale(run) },
    logs: logPage.entries,
    cursor: logPage.next,
    matter: cs ? toMatter(cs) : null,
    outputs: outList.filter((o) => o.runId === id).map(toOutputSummary),
    workflow: wf ? toWorkflowSummary(wf) : null,
  };
}

export interface OutputsData {
  outputs: OutputSummary[];
  matters: Matter[];
}

export async function getOutputsData(caseId?: string): Promise<OutputsData> {
  const [outList, cs] = await Promise.all([outputs.list(), cases.list()]);
  return { outputs: outList.filter((o) => !caseId || o.caseId === caseId).map(toOutputSummary), matters: cs.map(toMatter) };
}

export async function getOutputPage(id: string) {
  const record = await outputs.get(id);
  if (!record) return null;
  const [raw, recordCase] = await Promise.all([getOutput(id), record.caseId ? cases.get(record.caseId) : Promise.resolve(null)]);
  const actual = await hashJSON(raw.content);
  return {
    record,
    content: raw.content,
    integrity: { id, expected: record.hash, actual, intact: actual === record.hash },
    matter: recordCase ? toMatter(recordCase) : null,
  };
}

export interface AuditData {
  anchors: AnchorSummary[];
  matters: Matter[];
  documents: DocumentRecord[];
  runs: RunSummary[];
}

export async function getAuditData(): Promise<AuditData> {
  const [anchorList, cs, docs, runList] = await Promise.all([listAnchors({ refresh: true }), cases.list(), documents.list(), runs.list()]);
  return { anchors: anchorList, matters: cs.map(toMatter), documents: docs, runs: runList.map(toRunSummary) };
}

export async function getSettingsPage() {
  const [settings, system] = await Promise.all([getSettings(), getSystemStatus()]);
  return { settings, system };
}

export interface HistoryData {
  conversations: ConversationSummary[];
  runs: RunSummary[];
  matters: Matter[];
}

export async function getHistoryData(): Promise<HistoryData> {
  const [convs, runList, cs] = await Promise.all([conversations.list(), runs.list(), cases.list()]);
  return { conversations: convs.map(toConversationSummary), runs: runList.map(toRunSummary), matters: cs.map(toMatter) };
}

export interface SearchHit {
  id: string;
  title: string;
  meta: string;
  href: string;
}

export interface SearchResults {
  query: string;
  matters: SearchHit[];
  documents: SearchHit[];
  workflows: SearchHit[];
  outputs: SearchHit[];
  conversations: SearchHit[];
  total: number;
}

export async function searchWorkspace(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  const empty: SearchResults = { query, matters: [], documents: [], workflows: [], outputs: [], conversations: [], total: 0 };
  if (!q) return empty;
  const [cs, docs, wfList, outList, convs] = await Promise.all([cases.list(), documents.list(), workflows.list(), outputs.list(), conversations.list()]);
  const has = (...parts: (string | undefined)[]) => parts.some((p) => p?.toLowerCase().includes(q));

  const matterHits: SearchHit[] = cs
    .filter((c) => has(c.name, c.clientName, c.matterNumber, c.description))
    .map((c) => ({ id: c.id, title: caseTitle(c), meta: matterNumber(c), href: `/cases/${c.id}` }));
  const docHits: SearchHit[] = docs
    .filter((d) => has(d.name))
    .map((d) => ({ id: d.id, title: d.name, meta: `${d.pages ?? "—"} pages`, href: `/vault/${d.id}` }));
  const workflowHits: SearchHit[] = wfList
    .filter((w) => has(w.name, w.description))
    .map((w) => ({ id: w.id, title: w.name, meta: `${w.graph.nodes.length} nodes`, href: `/workflows/${w.id}` }));
  const outputHits: SearchHit[] = outList
    .filter((o) => has(o.title, o.kind))
    .map((o) => ({ id: o.id, title: o.title, meta: titleCase(o.kind), href: `/outputs/${o.id}` }));
  const conversationHits: SearchHit[] = convs
    .filter((c) => has(c.title))
    .map((c) => ({ id: c.id, title: c.title, meta: `${c.messages.length} messages`, href: `/chat/${c.id}` }));

  return {
    query,
    matters: matterHits,
    documents: docHits,
    workflows: workflowHits,
    outputs: outputHits,
    conversations: conversationHits,
    total: matterHits.length + docHits.length + workflowHits.length + outputHits.length + conversationHits.length,
  };
}
