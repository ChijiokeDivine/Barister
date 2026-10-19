import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { createAnchor } from "@/lib/services/anchors";

export const maxDuration = 60;

/** Anchor an arbitrary SHA-256 (e.g. hashed in the browser). Idempotent: same hash+kind returns the existing anchor. */
export const POST = route(async (req) => {
  const b = await parseBody(req, z.object({ hash: z.string().length(64), refId: z.string().optional() }));
  return json(await createAnchor({ kind: "custom", refId: b.refId, hash: b.hash }), 201);
});
