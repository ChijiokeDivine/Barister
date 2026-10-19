import { route } from "@/lib/api";
import { getDocument, integrityCheck } from "@/lib/services/documents";
import { verifyHash } from "@/lib/services/anchors";

export const maxDuration = 60;

/** Two independent checks: (1) vault bytes still hash to the recorded digest, (2) that digest is proven on-chain. */
export const GET = route<{ id: string }>(async (_r, { params }) => {
  const doc = await getDocument(params.id);
  const [integrity, chain] = await Promise.all([integrityCheck(params.id), verifyHash(doc.sha256)]);
  return { integrity, chain };
});
