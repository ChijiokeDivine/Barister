import { z } from "zod";
import { json, parseQuery, route } from "@/lib/api";
import { badRequest, tooLarge } from "@/lib/errors";
import { env } from "@/lib/env";
import { ingestFile, listDocuments } from "@/lib/services/documents";

export const maxDuration = 120;

export const GET = route(async (req) => {
  const { caseId } = parseQuery(req, z.object({ caseId: z.string().optional() }));
  // ?caseId=none → unassigned documents; omitted → everything.
  return listDocuments(caseId === undefined ? undefined : caseId === "none" ? null : caseId);
});

/**
 * Multipart upload: fields `file`, optional `caseId`, `clientHash` (SHA-256 computed in the browser, verified here),
 * `anchor=true` (anchor the original's hash on Sepolia). Files above MAX_UPLOAD_MB (Vercel's ~4.5MB body cap) must use
 * the /upload-token + /ingest flow.
 */
export const POST = route(async (req) => {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > (env().MAX_UPLOAD_MB + 1) * 1024 * 1024) throw tooLarge(`Upload exceeds ${env().MAX_UPLOAD_MB}MB. Use /api/documents/upload-token for large files.`);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest('Send multipart/form-data with a "file" field');
  const doc = await ingestFile({
    bytes: Buffer.from(await file.arrayBuffer()),
    filename: file.name || "upload",
    mime: file.type,
    caseId: (form!.get("caseId") as string) || null,
    clientHash: (form!.get("clientHash") as string) || undefined,
    anchor: form!.get("anchor") === "true",
  });
  return json(doc, 201);
});
