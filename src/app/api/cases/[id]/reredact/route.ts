import { route } from "@/lib/api";
import { getCase } from "@/lib/services/cases";
import { reredactCase } from "@/lib/services/documents";

export const maxDuration = 300;

/** Re-applies current settings + known terms to every document in the matter. */
export const POST = route<{ id: string }>(async (_r, { params }) => {
  await getCase(params.id);
  return reredactCase(params.id);
});
