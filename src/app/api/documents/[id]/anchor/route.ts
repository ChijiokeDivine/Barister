import { json, route } from "@/lib/api";
import { anchorDocument } from "@/lib/services/documents";

export const maxDuration = 60;
export const POST = route<{ id: string }>(async (_r, { params }) => json(await anchorDocument(params.id), 201));
