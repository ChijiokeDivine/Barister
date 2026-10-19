/**
 * Document vault: upload → verify hash → parse → encrypt → redact → store.
 * Three encrypted blobs per document: the original file (for faithful download), the parsed text, and the redacted
 * text. Only the redacted text is ever read by the agent engine.
 */
import { badRequest, conflict, notFound, tooLarge } from "../errors";
import { env } from "../env";
import { sha256Hex } from "../hash";
import { newId, nowIso } from "../ids";
import { parseDocument } from "../ingest/parse";
import type { EntityType } from "../redact";
import { delBlob, getBlob, getBlobText, putBlob, putBlobText } from "../store";
import { sealedRepo } from "../store/repo";
import { createAnchor } from "./anchors";
import { buildRedactor, persistVault } from "./redaction";
import { chainConfigured } from "../chain";

export interface DocumentRecord {
  id: string;
  caseId: string | null;
  name: string;
  mime: string;
  size: number;
  pages: number | null;
  kind: "pdf" | "docx" | "text";
  sha256: string; // of the ORIGINAL bytes — what gets anchored and what verification recomputes
  redactedSha256: string;
  charCount: number;
  stats: Partial<Record<EntityType, number>>;
  anchorId?: string;
  createdAt: string;
  redactedAt: string;
}

export const documents = sealedRepo<DocumentRecord>("documents");
const key = (id: string, part: "file" | "text" | "redacted") => `docs/${id}/${part}`;

export async function getDocument(id: string): Promise<DocumentRecord> {
  const d = await documents.get(id);
  if (!d) throw notFound("Document");
  return d;
}

export async function listDocuments(caseId?: string | null) {
  const all = await documents.list();
  return caseId === undefined ? all : all.filter((d) => d.caseId === caseId);
}

/** (Re)builds the redacted text from stored raw text using the CURRENT settings/known terms. */
export async function redactDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  const raw = await getBlobText(key(doc.id, "text"));
  if (raw === null) throw notFound("Document text");
  const redactor = await buildRedactor(doc.caseId);
  const out = redactor.redact(raw);
  await putBlobText(key(doc.id, "redacted"), out.text);
  await persistVault(doc.caseId, redactor);
  return documents.put({ ...doc, stats: out.stats, redactedSha256: await sha256Hex(out.text), redactedAt: nowIso() });
}

export async function ingestFile(input: { bytes: Buffer; filename: string; mime?: string; caseId?: string | null; clientHash?: string; anchor?: boolean; maxMb?: number }): Promise<DocumentRecord> {
  const maxMb = input.maxMb ?? env().MAX_UPLOAD_MB;
  const max = maxMb * 1024 * 1024;
  if (input.bytes.length === 0) throw badRequest("The file is empty");
  if (input.bytes.length > max) throw tooLarge(`File exceeds ${maxMb}MB.${input.maxMb ? "" : " Use the large-file upload flow (/api/documents/upload-token)."}`);

  const sha = await sha256Hex(input.bytes);
  // The frontend hashes in the browser before upload; a mismatch means the file changed in transit or the client is wrong.
  if (input.clientHash && input.clientHash.toLowerCase() !== sha) throw conflict("Client and server SHA-256 differ — the file was altered or corrupted in transit");

  // Same bytes in the same matter → return the existing record instead of duplicating (and double-anchoring).
  const dup = (await documents.list()).find((d) => d.sha256 === sha && d.caseId === (input.caseId ?? null));
  if (dup) return dup;

  const parsed = await parseDocument(input.bytes, input.filename);
  const id = newId("doc");
  await Promise.all([putBlob(key(id, "file"), input.bytes), putBlobText(key(id, "text"), parsed.text)]);

  const base: DocumentRecord = {
    id, caseId: input.caseId ?? null, name: input.filename.slice(0, 255), mime: input.mime || "application/octet-stream", size: input.bytes.length,
    pages: parsed.pages, kind: parsed.kind, sha256: sha, redactedSha256: "", charCount: parsed.text.length, stats: {}, createdAt: nowIso(), redactedAt: nowIso(),
  };
  let doc = await redactDocument(await documents.put(base));

  if (input.anchor && chainConfigured()) {
    // Best effort: a chain hiccup must not lose an upload that already succeeded.
    const a = await createAnchor({ kind: "document", refId: id, hash: sha }).catch(() => null);
    if (a) doc = await documents.put({ ...doc, anchorId: a.id });
  }
  return doc;
}

export async function anchorDocument(id: string) {
  const doc = await getDocument(id);
  const a = await createAnchor({ kind: "document", refId: id, hash: doc.sha256 });
  await documents.put({ ...doc, anchorId: a.id });
  return a;
}

/** Original vs redacted view, paginated: transcripts can be megabytes. */
export async function readText(id: string, view: "original" | "redacted", offset: number, limit: number) {
  const doc = await getDocument(id);
  const text = await getBlobText(key(id, view === "original" ? "text" : "redacted"));
  if (text === null) throw notFound("Document text");
  return { id, view, total: text.length, offset, text: text.slice(offset, offset + limit), hasMore: offset + limit < text.length, name: doc.name };
}

export async function readOriginalFile(id: string) {
  const doc = await getDocument(id);
  const bytes = await getBlob(key(id, "file"));
  if (!bytes) throw notFound("Document file");
  return { doc, bytes };
}

/** Recompute SHA-256 from stored bytes: proves the vault copy is still byte-identical to what was anchored. */
export async function integrityCheck(id: string) {
  const { doc, bytes } = await readOriginalFile(id);
  const current = await sha256Hex(bytes);
  return { id, expected: doc.sha256, actual: current, intact: current === doc.sha256 };
}

/**
 * Documents for an agent run. STRICT matter isolation: every document must belong to the run's matter, because
 * tokens are minted per-matter — mixing matters would break rehydration and leak one client's data into another's run.
 */
export async function loadRedactedDocs(ids: string[] | undefined, caseId: string | null) {
  const list = ids?.length ? await Promise.all(ids.map(getDocument)) : await listDocuments(caseId);
  const foreign = list.find((d) => d.caseId !== caseId);
  if (foreign) throw badRequest(`Document ${foreign.id} does not belong to this matter`);
  return Promise.all(
    list.map(async (d) => {
      const text = await getBlobText(key(d.id, "redacted"));
      if (text === null) throw notFound(`Redacted text for ${d.id}`);
      return { id: d.id, name: d.name, text, pages: d.pages };
    }),
  );
}

export async function deleteDocument(id: string) {
  await getDocument(id);
  await Promise.all([delBlob(key(id, "file")), delBlob(key(id, "text")), delBlob(key(id, "redacted"))]);
  await documents.del(id);
}

export async function reredactCase(caseId: string | null) {
  const docs = await listDocuments(caseId);
  // Sequential: each pass may mint tokens; keeping it serial avoids hammering the CPU in a serverless function.
  let n = 0;
  for (const d of docs) {
    await redactDocument(d);
    n++;
  }
  return { reredacted: n };
}
