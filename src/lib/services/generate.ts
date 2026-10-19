import { z } from "zod";
import type { WorkflowGraph } from "../agents/schemas";
import type { LLMRouter } from "../llm/router";
import type { Redactor } from "../redact";
import { badRequest } from "../errors";
import { autoLayout, generatorSystemPrompt, GeneratedWorkflowSchema, graphProblems } from "./workflows";

const IntentSchema = z.object({ action: z.enum(["answer", "build_workflow"]) });

/** Cheap pre-filter: only words that plausibly mean "make me a workflow" pay for the classifier call. */
const WORKFLOW_HINT = /\b(workflow|pipeline|automate|automation|agents?|build (me )?(a|an)|set ?up (a|an)|create (a|an) .*(flow|process))\b/i;

export async function detectWorkflowIntent(llm: LLMRouter, text: string): Promise<boolean> {
  if (!WORKFLOW_HINT.test(text)) return false;
  const { action } = await llm.json(
    IntentSchema,
    {
      system: 'Decide whether the user is asking the assistant to BUILD/CREATE an automated multi-step workflow or agent pipeline ("build_workflow"), or just asking a question / requesting analysis / chatting ("answer"). Return {"action": ...}.',
      messages: [{ role: "user", content: text.slice(0, 2000) }],
      temperature: 0,
      maxOutputTokens: 50,
    },
    { tier: "fast", where: "intent", repairs: 0 },
  ).catch(() => ({ action: "answer" as const })); // classifier failure must never block normal chat
  return action === "build_workflow";
}

/**
 * NL → validated workflow graph. Two layers of checking: zod (shape) inside llm.json, then validateWorkflow
 * (semantics: wiring, cycles, gate rules). Semantic failures are fed back to the model as a repair prompt.
 */
export async function generateWorkflow(llm: LLMRouter, redactor: Redactor, request: string): Promise<{ name: string; description: string; graph: WorkflowGraph }> {
  // The request may name parties; redact before it reaches the model, restore names in the result.
  const safeRequest = redactor.redact(request).text;
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await llm.json(
      GeneratedWorkflowSchema,
      { system: generatorSystemPrompt(), messages: [{ role: "user", content: `${safeRequest}${feedback}` }], temperature: 0.2, maxOutputTokens: 4_000 },
      { tier: "fast", where: "generate-workflow" },
    );
    const problems = graphProblems(out.graph);
    if (!problems.length) return redactor.restoreDeep({ ...out, graph: autoLayout(out.graph) });
    feedback = `\n\nYour previous graph was invalid. Fix these problems and return the full corrected JSON:\n- ${problems.join("\n- ")}`;
  }
  throw badRequest("Could not generate a valid workflow from that description. Try rephrasing, or start from a template.");
}
