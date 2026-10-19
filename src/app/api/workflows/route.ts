import { json, parseBody, route } from "@/lib/api";
import { createWorkflow, WorkflowInputSchema, workflows } from "@/lib/services/workflows";

// List omits graphs (can be large) — fetch /api/workflows/:id for the canvas.
export const GET = route(async () => (await workflows.list()).map(({ graph, ...w }) => ({ ...w, nodeCount: graph.nodes.length })));
export const POST = route(async (req) => json(await createWorkflow(await parseBody(req, WorkflowInputSchema)), 201));
