import { after } from "next/server";
import { json, route } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { executeRun, getRun, isStale } from "@/lib/services/runs";

export const maxDuration = 300;

/** Re-executes a failed/cancelled/stalled run. Finished LLM chunks are cached, so only unfinished work is paid for again. */
export const POST = route<{ id: string }>(async (_r, { params }) => {
  const run = await getRun(params.id);
  if (run.status === "succeeded") throw conflict("Run already succeeded");
  if (run.status === "running" && !isStale(run)) throw conflict("Run is still executing");
  after(() => executeRun(run.id).catch((e) => console.error("[run]", run.id, e)));
  return json({ id: run.id, resuming: true }, 202);
});
