import { route } from "@/lib/api";
import { getDocument, redactDocument } from "@/lib/services/documents";

export const POST = route<{ id: string }>(async (_r, { params }) => redactDocument(await getDocument(params.id)));
