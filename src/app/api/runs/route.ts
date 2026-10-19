import { after } from "next/server";
import { z } from "zod";
import { json, parseBody, parseQuery, route } from "@/lib/api";
import { WorkflowGraphSchema } from "@/lib/agents/schemas";
import { createRun, executeRun, listRuns } from "@/lib/services/runs";

// Applies to the background work started via after(): it runs inside this function's time budget.
export const maxDuration = 300;

const Body = z
  .object({
    workflowId: z.string().optional(),
    graph: WorkflowGraphSchema.optional(),
    name: z.string().max(120).optional(),
    caseId: z.string().nullish(),
    docIds: z.array(z.string()).max(500).optional(),
    instructions: z.string().max(4000).optional(),
  })
  .refine((b) => b.workflowId || b.graph, "Provide workflowId or graph");

export const GET = route(async (req) => {
  const q = parseQuery(req, z.object({ status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional(), caseId: z.string().optional() }));
  return (await listRuns(q)).map(({ graph, ...r }) => r);
});

/**
 * Validates synchronously (400 with per-node issues if the canvas is broken), returns 202 + run id immediately,
 * and executes in the background via after(). Frontend: poll GET /api/runs/:id and tail /api/runs/:id/stream.
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const run = await createRun({ ...body, caseId: body.caseId ?? null });
  after(() => executeRun(run.id).catch((e) => console.error("[run]", run.id, e)));
  return json({ id: run.id, status: run.status }, 202);
});
