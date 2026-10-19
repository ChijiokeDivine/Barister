import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { outputs } from "@/lib/services/outputs";

export const GET = route(async (req) => {
  const q = parseQuery(req, z.object({ caseId: z.string().optional(), kind: z.enum(["trial_outline", "timeline", "risk_matrix", "report"]).optional() }));
  return (await outputs.list()).filter((o) => (!q.caseId || o.caseId === q.caseId) && (!q.kind || o.kind === q.kind));
});
