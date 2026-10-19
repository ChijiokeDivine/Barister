import { route } from "@/lib/api";
import { getLogTail, isStale, listRuns } from "@/lib/services/runs";

/** Agent execution monitor: active runs plus the latest notable log lines of each (the thought-process feed). */
export const GET = route(async () => {
  const all = await listRuns();
  const active = all.filter((r) => r.status === "running" || r.status === "queued").slice(0, 10);
  const items = await Promise.all(
    active.map(async (r) => {
      const { graph, ...rest } = r;
      const tail = await getLogTail(r.id, 40);
      return { ...rest, stalled: isStale(r), nodeCount: graph.nodes.length, recent: tail.filter((l) => l.level !== "info" || l.data).slice(-10) };
    }),
  );
  return { active: items, recentFinished: all.filter((r) => !["running", "queued"].includes(r.status)).slice(0, 10).map(({ graph: _g, ...r }) => r) };
});
