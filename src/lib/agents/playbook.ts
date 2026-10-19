import { z } from "zod";

export const PlaybookRuleSchema = z.object({
  id: z.string().min(1).max(64),
  clause: z.string().min(1).max(120).describe("Clause topic, e.g. 'Limitation of liability'"),
  preferred: z.string().min(1).max(2000),
  fallback: z.string().max(2000).optional(),
  redLine: z.string().max(2000).optional(),
});
