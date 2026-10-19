import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { makeOutboundGuard } from "@/lib/agents/guard";
import { LLMRouter } from "@/lib/llm/router";
import { generateWorkflow } from "@/lib/services/generate";
import { buildRedactor } from "@/lib/services/redaction";

export const maxDuration = 60;

/** Natural language → validated, auto-laid-out workflow graph (not saved; the UI shows it on the canvas, then POST /api/workflows to save). */
export const POST = route(async (req) => {
  const { prompt, caseId } = await parseBody(req, z.object({ prompt: z.string().min(5).max(4000), caseId: z.string().nullish() }));
  const redactor = await buildRedactor(caseId);
  return generateWorkflow(new LLMRouter({ outbound: makeOutboundGuard(redactor) }), redactor, prompt);
});
