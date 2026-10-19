import { route } from "@/lib/api";
import { getRun, isStale } from "@/lib/services/runs";

export const GET = route<{ id: string }>(async (_r, { params }) => {
  const run = await getRun(params.id);
  // `resumable` = failed/cancelled, or "running" with a dead heartbeat (function was killed mid-run).
  return { ...run, resumable: run.status === "failed" || run.status === "cancelled" || isStale(run) };
});
