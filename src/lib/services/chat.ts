/**
 * Chat workspace: grounded Q&A over matter documents + natural-language workflow creation.
 *
 * Privacy flow per turn: history/docs/user text → redact → model → stream through the SAME redactor's
 * stream-restorer, so the attorney sees real names while the cloud only ever sees tokens.
 */
import type { WorkflowGraph } from "../agents/schemas";
import { makeOutboundGuard } from "../agents/guard";
import { env } from "../env";
import { badRequest, notFound } from "../errors";
import { newId, nowIso } from "../ids";
import { LLMRouter } from "../llm/router";
import { sealedRepo } from "../store/repo";
import { truncate } from "../util";
import { getCase } from "./cases";
import { loadRedactedDocs } from "./documents";
import { detectWorkflowIntent, generateWorkflow } from "./generate";
import { buildRedactor, persistVault } from "./redaction";
import { getSettings } from "./settings";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
  workflow?: { name: string; description: string; graph: WorkflowGraph };
}
export interface Conversation {
  id: string;
  caseId: string | null;
  title: string;
  docIds: string[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const conversations = sealedRepo<Conversation>("conversations");

export async function getConversation(id: string) {
  const c = await conversations.get(id);
  if (!c) throw notFound("Conversation");
  return c;
}

const SYSTEM = `You are a careful legal research and drafting assistant for attorneys.
- Text you receive is pseudonymised: tokens like [NAME_AB12CD] stand for real people/entities. Copy tokens exactly; never guess who they are.
- Ground answers in the provided DOCUMENTS and cite them by name (and page, via [[PAGE n]] markers) when you rely on them. If the documents don't say, say so.
- You are not a substitute for attorney judgment; flag uncertainty and assumptions plainly. Be concise and precise.
- Format answers as GitHub-flavoured Markdown: short headings, bullet lists, and pipe tables when comparing items. Use **bold** sparingly. Emit links as plain Markdown links. Never emit HTML tags (no <br>, no <div>).
- If the user wants an automated multi-step process, tell them you can build it as a workflow.`;

export interface ChatTurn {
  conversationId?: string;
  /** Inline edit: drop this user message and everything after it, then treat `message` as its replacement. */
  editIndex?: number;
  caseId?: string | null;
  docIds?: string[];
  message: string;
  /** Model routing override. "auto" keeps the context-size heuristic. */
  tier?: "auto" | "long" | "fast";
  /** Which grounding sources the attorney enabled. Only vault + playbooks are wired in this deployment. */
  sources?: ChatSource[];
}

export type ChatSource = "vault" | "playbooks" | "web" | "caselaw";

type Send = (event: string, data: unknown) => void;

export async function chatTurn(turn: ChatTurn, send: Send, signal: AbortSignal): Promise<void> {
  const existing = turn.conversationId ? await getConversation(turn.conversationId) : null;
  const caseId = existing ? existing.caseId : (turn.caseId ?? null);
  if (caseId) await getCase(caseId);

  const conv: Conversation =
    existing ?? { id: newId("chat"), caseId, title: truncate(turn.message.replace(/\s+/g, " "), 60), docIds: [], messages: [], createdAt: nowIso(), updatedAt: nowIso() };
  if (turn.docIds) conv.docIds = turn.docIds; // the UI sends the current attachment selection each turn
  // Inline edit: the edited message replaces this one, and everything the model said afterwards is discarded.
  if (existing && turn.editIndex !== undefined) {
    const target = conv.messages[turn.editIndex];
    if (!target || target.role !== "user") throw badRequest("Only one of your own messages can be edited");
    conv.messages = conv.messages.slice(0, turn.editIndex);
    if (turn.editIndex === 0) conv.title = truncate(turn.message.replace(/\s+/g, " "), 60);
  }
  const activeSources: ChatSource[] = turn.sources?.length ? turn.sources : ["vault"];
  send("meta", { conversationId: conv.id, caseId, sources: activeSources });

  const redactor = await buildRedactor(caseId);
  const llm = new LLMRouter({ outbound: makeOutboundGuard(redactor) });
  conv.messages.push({ role: "user", content: turn.message, ts: nowIso() });
  let completed = false;

  try {
    // ── 1. Workflow request? ──
    if (await detectWorkflowIntent(llm, redactor.redact(turn.message).text)) {
      send("status", { stage: "building_workflow" });
      const wf = await generateWorkflow(llm, redactor, turn.message);
      const text = `I've drafted a workflow, "${wf.name}": ${wf.description} Review it on the canvas, then save or run it.`;
      send("workflow", wf);
      send("delta", { text });
      conv.messages.push({ role: "assistant", content: text, ts: nowIso(), workflow: wf });
      completed = true;
      return;
    }

    // ── 2. Grounded answer ──
    const useVault = activeSources.includes("vault");
    const docs = useVault
      ? conv.docIds.length
        ? await loadRedactedDocs(conv.docIds, caseId)
        : caseId
          ? await loadRedactedDocs(undefined, caseId)
          : []
      : [];
    const fastBudget = Math.floor(env().GROQ_MAX_CONTEXT_CHARS * 0.6);
    const docChars = docs.reduce((n, d) => n + d.text.length, 0);
    // Explicit routing wins; "auto" keeps the context-size heuristic (big attachments don't fit Groq's window).
    const tier = turn.tier && turn.tier !== "auto" ? turn.tier : docChars > fastBudget ? "long" : "fast";
    const budget = tier === "long" ? 900_000 : fastBudget;
    let remaining = budget;
    const docBlock = docs
      .map((d) => {
        const body = truncate(d.text, Math.max(0, remaining));
        remaining -= body.length;
        return `### ${redactor.redact(d.name).text}\n${body}`;
      })
      .join("\n\n");
    if (docChars > budget) send("status", { stage: "context_truncated", included: budget, total: docChars });

    let system = SYSTEM;
    if (activeSources.includes("playbooks")) {
      const playbook = (await getSettings()).playbook;
      if (playbook.length) {
        const block = playbook
          .map((r) => `- ${r.clause}: preferred = ${r.preferred}${r.fallback ? `; fallback = ${r.fallback}` : ""}${r.redLine ? `; RED LINE = ${r.redLine}` : ""}`)
          .join("\n");
        system += `\n\nFIRM PLAYBOOK (apply when relevant; never quote it verbatim unless asked):\n${redactor.redact(block).text}`;
      }
    }

    const history = conv.messages.slice(-21, -1).map((m) => ({ role: m.role, content: redactor.redact(m.content).text }));
    const messages = [...history, { role: "user" as const, content: `${docBlock ? `DOCUMENTS:\n${docBlock}\n\n---\n\n` : ""}${redactor.redact(turn.message).text}` }];

    // Rehydrate as tokens stream in (holds back a small tail so tokens split across chunks still match).
    const restorer = redactor.stream();
    let answer = "";
    for await (const chunk of llm.stream({ system, messages, temperature: 0.3, maxOutputTokens: 4_096, signal }, { tier, where: "chat" })) {
      const out = restorer.push(chunk);
      if (out) {
        answer += out;
        send("delta", { text: out });
      }
    }
    const tail = restorer.flush();
    if (tail) {
      answer += tail;
      send("delta", { text: tail });
    }
    conv.messages.push({ role: "assistant", content: answer, ts: nowIso() });
    completed = true;
  } finally {
    // Always persist (a failed turn keeps the user's message) but only announce "done" on success; on failure the
    // SSE wrapper emits "error" instead, so the client never sees done-then-error.
    conv.updatedAt = nowIso();
    await Promise.all([conversations.put(conv), persistVault(caseId, redactor)]);
    if (completed) send("done", { conversationId: conv.id });
  }
}
