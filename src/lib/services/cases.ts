import { z } from "zod";
import { newId, nowIso } from "../ids";
import { notFound } from "../errors";
import { kv } from "../store";
import { sealedRepo } from "../store/repo";

const KnownTermSchema = z.object({
  value: z.string().min(2).max(200),
  type: z.enum(["NAME", "EMAIL", "PHONE", "SSN", "CARD", "AMOUNT", "DATE", "ADDRESS", "IP", "URL", "CUSTOM"]).default("NAME"),
  aliases: z.array(z.string().min(2).max(200)).max(30).default([]),
});

export const CaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().max(200).optional(),
  matterNumber: z.string().max(80).optional(),
  description: z.string().max(5000).default(""),
  status: z.enum(["open", "closed"]).default("open"),
  /** Parties/witnesses known up-front. Highest-precision redaction: aliases share one token. */
  knownTerms: z.array(KnownTermSchema).max(500).default([]),
});
export type CaseInput = z.infer<typeof CaseInputSchema>;
export type Case = CaseInput & { id: string; createdAt: string; updatedAt: string };

export const cases = sealedRepo<Case>("cases");

export async function createCase(input: unknown): Promise<Case> {
  const now = nowIso();
  return cases.put({ ...CaseInputSchema.parse(input), id: newId("case"), createdAt: now, updatedAt: now });
}

export async function getCase(id: string): Promise<Case> {
  const c = await cases.get(id);
  if (!c) throw notFound("Case");
  return c;
}

export async function updateCase(id: string, patch: unknown): Promise<Case> {
  const cur = await getCase(id);
  const next = CaseInputSchema.partial().parse(patch);
  return cases.put({ ...cur, ...next, updatedAt: nowIso() });
}

/** Removes the case record + its vault. Documents are removed by the documents service first (see route). */
export async function deleteCase(id: string) {
  await getCase(id);
  await kv().delKey(`vault:${id}`);
  await cases.del(id);
}
