import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { loadVault, scopeOf } from "@/lib/services/redaction";

/** token → original mapping for a matter (what the attorney sees as "what was masked"). Behind auth; values are the real PII. */
export const GET = route(async (req) => {
  const { caseId } = parseQuery(req, z.object({ caseId: z.string().optional() }));
  const vault = await loadVault(scopeOf(caseId));
  return Object.entries(vault).map(([token, e]) => ({ token: `[${token}]`, type: e.type, value: e.value })).sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
});
