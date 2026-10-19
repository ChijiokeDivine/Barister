import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { WorkflowGraphSchema } from "@/lib/agents/schemas";
import { validateWorkflow } from "@/lib/agents/validate";

/** Live canvas validation (no LLM, no storage): returns per-node issues so the UI can highlight broken nodes as users wire them. */
export const POST = route(async (req) => {
  const { graph } = await parseBody(req, z.object({ graph: WorkflowGraphSchema }));
  const { issues, order } = validateWorkflow(graph);
  return { valid: issues.length === 0, issues, order };
});
