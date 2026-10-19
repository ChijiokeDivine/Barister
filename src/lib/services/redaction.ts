/**
 * Redactor factory + per-matter vault.
 *
 * Each matter has its own vault (token → original). Tokens are KEYED HASHES of the value (not counters):
 *   - the same name gets the same token in every document of the matter (cross-document reasoning works),
 *   - concurrent uploads need no locking (both derive the same token independently),
 *   - tokens can't be reversed or guessed without the server key.
 * The date shift is likewise derived from the matter id, so it's stable across runs/sessions and needs no storage.
 */
import { keyedCode, keyedInt, openJSON, sealJSON } from "../crypto";
import { Redactor, type EntityType, type VaultEntry } from "../redact";
import { kv } from "../store";
import { getSettings } from "./settings";
import { getCase } from "./cases";

export const GLOBAL_SCOPE = "global";
export const scopeOf = (caseId: string | null | undefined) => caseId ?? GLOBAL_SCOPE;

const tokenStrategy = (scope: string) => (type: EntityType, normalized: string, attempt: number) =>
  `${type}_${keyedCode(`${scope}:${type}`, attempt ? `${normalized}#${attempt}` : normalized, 6)}`;

/** 30 days – 3 years. Large enough to hide real dates, small enough to keep seasons/rough eras plausible. */
export const dateShiftFor = (scope: string) => keyedInt(`shift:${scope}`, 30, 1095);

export async function loadVault(scope: string): Promise<Record<string, VaultEntry>> {
  const raw = await kv().hgetall(`vault:${scope}`);
  return Object.fromEntries(Object.entries(raw).map(([token, sealed]) => [token, openJSON<VaultEntry>(sealed)]));
}

export async function buildRedactor(caseId: string | null | undefined): Promise<Redactor> {
  const scope = scopeOf(caseId);
  const [settings, entries, theCase] = await Promise.all([getSettings(), loadVault(scope), caseId ? getCase(caseId) : null]);
  return new Redactor({
    settings: settings.redaction,
    known: theCase?.knownTerms,
    entries,
    tokenFor: tokenStrategy(scope),
    dateShiftDays: dateShiftFor(scope),
  });
}

/** Writes any newly minted tokens. Field-level hset → concurrent writers can't overwrite each other. */
export async function persistVault(caseId: string | null | undefined, redactor: Redactor): Promise<number> {
  const fresh = redactor.takeUnsaved();
  const tokens = Object.keys(fresh);
  if (tokens.length) await kv().hset(`vault:${scopeOf(caseId)}`, Object.fromEntries(tokens.map((t) => [t, sealJSON(fresh[t])])));
  return tokens.length;
}

/** Stateless preview (no persistence): powers the live "type text, see redaction" transparency UI. */
export async function previewRedaction(text: string, caseId?: string | null) {
  const r = await buildRedactor(caseId);
  const out = r.redact(text);
  return { redacted: out.text, stats: out.stats, restored: r.restore(out.text) };
}
