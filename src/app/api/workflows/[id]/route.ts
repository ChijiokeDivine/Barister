import { parseBody, route } from "@/lib/api";
import { getWorkflow, updateWorkflow, workflows, WorkflowInputSchema } from "@/lib/services/workflows";

type P = { id: string };
export const GET = route<P>(async (_r, { params }) => getWorkflow(params.id));
export const PUT = route<P>(async (req, { params }) => updateWorkflow(params.id, await parseBody(req, WorkflowInputSchema.partial())));
export const DELETE = route<P>(async (_r, { params }) => (await getWorkflow(params.id), await workflows.del(params.id), { deleted: true }));
