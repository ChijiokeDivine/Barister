import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { env } from "@/lib/env";
import { badRequest } from "@/lib/errors";
import { getStore } from "@/lib/store";

/**
 * Step 1 of large uploads: issues a short-lived client token so the browser uploads straight to Vercel Blob
 * (bypassing the 4.5MB function body limit). Client: `upload(path, file, { access: "private", handleUploadUrl, headers: { Authorization } })`.
 * Path MUST start with "incoming/". The raw blob is deleted by /ingest right after we encrypt + store it ourselves.
 * Custom handler (not route()) because handleUpload needs the raw request body in its own format.
 */
export async function POST(req: Request) {
  try {
    requireAuth(req);
    if (getStore().driver !== "cloud") throw badRequest("Large uploads need cloud storage (Vercel Blob). Use /api/documents with files ≤ MAX_UPLOAD_MB locally.");
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("incoming/")) throw badRequest('pathname must start with "incoming/"');
        return {
          maximumSizeInBytes: env().MAX_LARGE_UPLOAD_MB * 1024 * 1024,
          allowedContentTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "text/csv", "application/octet-stream"],
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
