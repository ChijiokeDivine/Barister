import { z } from "zod";
import { parseQuery, route, sse } from "@/lib/api";
import { getLogs, getRun } from "@/lib/services/runs";

export const maxDuration = 300;

/**
 * Live log tail over SSE (events: log, status, end). Polls storage (works on serverless, where there's no shared memory
 * between the function running the job and the one serving this stream). On reconnect pass ?after=<last cursor>.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { after } = parseQuery(req, z.object({ after: z.coerce.number().int().min(0).default(0) }));
  await getRun(params.id); // 404 before opening a stream
  return sse(async (send, signal) => {
    let cursor = after;
    let lastStatus = "";
    const deadline = Date.now() + 280_000; // leave headroom under maxDuration; client reconnects with the cursor
    while (!signal.aborted && Date.now() < deadline) {
      const { entries, next } = await getLogs(params.id, cursor);
      for (const entry of entries) send("log", { entry, cursor: ++cursor });
      cursor = next;
      const run = await getRun(params.id);
      if (run.status !== lastStatus) send("status", { status: run.status });
      lastStatus = run.status;
      if (["succeeded", "failed", "cancelled"].includes(run.status) && entries.length === 0) {
        send("end", { status: run.status, outputs: run.outputs, error: run.error });
        return;
      }
      await new Promise((r) => setTimeout(r, entries.length ? 300 : 1_500));
    }
    send("reconnect", { cursor });
  });
});
