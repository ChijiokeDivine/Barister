import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { EXPLORER } from "@/lib/chain";
import { listAnchors } from "@/lib/services/anchors";

export const maxDuration = 60;

/** On-chain verification ledger. `refresh=true` (default) polls the chain for up to 10 pending anchors first. */
export const GET = route(async (req) => {
  const q = parseQuery(req, z.object({ kind: z.enum(["document", "run_proof", "custom"]).optional(), refresh: z.enum(["true", "false"]).default("true") }));
  const list = await listAnchors({ kind: q.kind, refresh: q.refresh === "true" });
  return { explorer: EXPLORER, network: "sepolia", anchors: list };
});
