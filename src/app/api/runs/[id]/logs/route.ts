import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { getLogs, getRun } from "@/lib/services/runs";

/** Cursor-paged agent thought-process log: pass back `next` as `after` to fetch only new entries. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { after } = parseQuery(req, z.object({ after: z.coerce.number().int().min(0).default(0) }));
  const run = await getRun(params.id);
  return { ...(await getLogs(params.id, after)), status: run.status };
});
