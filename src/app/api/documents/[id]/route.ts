import { route } from "@/lib/api";
import { deleteDocument, getDocument } from "@/lib/services/documents";

type P = { id: string };
export const GET = route<P>(async (_r, { params }) => getDocument(params.id));
export const DELETE = route<P>(async (_r, { params }) => (await deleteDocument(params.id), { deleted: true }));
