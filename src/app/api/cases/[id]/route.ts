import { parseBody, route } from "@/lib/api";
import { CaseInputSchema, deleteCase, getCase, updateCase } from "@/lib/services/cases";
import { deleteDocument, listDocuments } from "@/lib/services/documents";

type P = { id: string };

export const GET = route<P>(async (_r, { params }) => {
  const [c, docs] = await Promise.all([getCase(params.id), listDocuments(params.id)]);
  return { ...c, documents: docs };
});

/** Editing knownTerms changes how FUTURE documents redact; call /reredact to apply to existing ones. */
export const PATCH = route<P>(async (req, { params }) => updateCase(params.id, await parseBody(req, CaseInputSchema.partial())));

export const DELETE = route<P>(async (_r, { params }) => {
  // Cascade: documents first (their blobs), then the case + vault. Deleting a matter must leave no ciphertext behind.
  for (const d of await listDocuments(params.id)) await deleteDocument(d.id);
  await deleteCase(params.id);
  return { deleted: true };
});
