import { route } from "@/lib/api";
import { listAnchors } from "@/lib/services/anchors";
import { cases } from "@/lib/services/cases";
import { documents } from "@/lib/services/documents";
import { outputs } from "@/lib/services/outputs";
import { isStale, runs } from "@/lib/services/runs";
import { workflows } from "@/lib/services/workflows";

export const GET = route(async () => {
  const [cs, docs, wfs, rs, outs, anchors] = await Promise.all([cases.list(), documents.list(), workflows.list(), runs.list(), outputs.list(), listAnchors()]);
  const redactions = docs.reduce((n, d) => n + Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0), 0);
  return {
    counts: {
      cases: cs.length, openCases: cs.filter((c) => c.status === "open").length, documents: docs.length, workflows: wfs.length, outputs: outs.length,
      runsRunning: rs.filter((r) => r.status === "running" && !isStale(r)).length, runsFailed: rs.filter((r) => r.status === "failed").length,
      piiRedactions: redactions, anchorsConfirmed: anchors.filter((a) => a.status === "confirmed").length, anchorsPending: anchors.filter((a) => a.status === "pending").length,
    },
    // Strip graph snapshots: the overview only needs headline fields.
    recentRuns: rs.slice(0, 8).map(({ graph: _g, ...r }) => r),
    recentOutputs: outs.slice(0, 5),
  };
});
