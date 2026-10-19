import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { readText } from "@/lib/services/documents";

/**
 * Powers the vault's Original ⇄ Redacted toggle. Paginated (default 50k chars) because transcripts can be megabytes;
 * the same offset in both views lines up roughly but NOT exactly (tokens differ in length) — the UI should page each independently.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const q = parseQuery(req, z.object({ view: z.enum(["original", "redacted"]).default("redacted"), offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(200_000).default(50_000) }));
  return readText(params.id, q.view, q.offset, q.limit);
});
