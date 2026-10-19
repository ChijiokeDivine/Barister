import type { OutputContent, OutputKind } from "../agents/context";
import { notFound } from "../errors";
import { hashJSON } from "../hash";
import { newId, nowIso } from "../ids";
import { getBlob, putBlobText, getBlobText, delBlob } from "../store";
import { sealedRepo } from "../store/repo";

export interface OutputRecord {
  id: string;
  runId: string;
  caseId: string | null;
  kind: OutputKind;
  title: string;
  /** SHA-256 of canonical JSON of the content — recomputed by verification to prove the saved deliverable is untouched. */
  hash: string;
  createdAt: string;
}

export const outputs = sealedRepo<OutputRecord>("outputs");
const blobKey = (id: string) => `outputs/${id}`;

export async function saveOutputContent(input: { runId: string; caseId: string | null; content: OutputContent }): Promise<OutputRecord> {
  const id = newId("out");
  // Content in its own blob (can be large); the sealed record stays small so list pages are fast.
  await putBlobText(blobKey(id), JSON.stringify(input.content));
  return outputs.put({ id, runId: input.runId, caseId: input.caseId, kind: input.content.kind, title: input.content.title, hash: await hashJSON(input.content), createdAt: nowIso() });
}

export async function getOutput(id: string): Promise<{ record: OutputRecord; content: OutputContent }> {
  const record = await outputs.get(id);
  const raw = record ? await getBlobText(blobKey(id)) : null;
  if (!record || raw === null) throw notFound("Output");
  return { record, content: JSON.parse(raw) as OutputContent };
}

export async function verifyOutputIntegrity(id: string) {
  const { record, content } = await getOutput(id);
  const actual = await hashJSON(content);
  return { id, expected: record.hash, actual, intact: actual === record.hash };
}

export async function deleteOutput(id: string) {
  await getOutput(id);
  await delBlob(blobKey(id));
  await outputs.del(id);
}

export const outputExists = async (id: string) => Boolean(await getBlob(blobKey(id)));
