import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { previewRedaction } from "@/lib/services/redaction";

/** Stateless live-redaction preview for the transparency UI / settings page. Nothing is stored. */
export const POST = route(async (req) => {
  const b = await parseBody(req, z.object({ text: z.string().max(200_000), caseId: z.string().nullish() }), 400_000);
  return previewRedaction(b.text, b.caseId);
});
