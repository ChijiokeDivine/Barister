import { get as blobGet, del as blobDel } from "@vercel/blob";
import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { env } from "@/lib/env";
import { badRequest, notFound } from "@/lib/errors";
import { ingestFile } from "@/lib/services/documents";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

const Body = z.object({
  pathname: z.string().min(1).max(512), // the blob pathname returned by the client upload
  filename: z.string().min(1).max(255),
  caseId: z.string().nullish(),
  clientHash: z.string().length(64).optional(),
  anchor: z.boolean().default(false),
});

/** Step 2 of large uploads: pull the raw blob, verify hash, parse + encrypt + redact, then DELETE the raw (unencrypted) blob. */
export const POST = route(async (req) => {
  if (getStore().driver !== "cloud") throw badRequest("Large uploads need cloud storage");
  const b = await parseBody(req, Body);
  if (!b.pathname.startsWith("incoming/")) throw badRequest('pathname must start with "incoming/"');
  const res = await blobGet(b.pathname, { access: "private", useCache: false }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) throw notFound("Uploaded blob");
  try {
    const bytes = Buffer.from(await new Response(res.stream).arrayBuffer());
    const doc = await ingestFile({ bytes, filename: b.filename, mime: res.blob.contentType, caseId: b.caseId ?? null, clientHash: b.clientHash, anchor: b.anchor, maxMb: env().MAX_LARGE_UPLOAD_MB });
    return json(doc, 201);
  } finally {
    // Always remove the plaintext staging copy, even if parsing failed.
    await blobDel(b.pathname).catch(() => undefined);
  }
});
