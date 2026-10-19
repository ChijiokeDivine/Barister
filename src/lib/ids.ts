/** Short, prefixed, unguessable ids (e.g. "case_9f2c…"). Prefix makes ids self-describing in logs/URLs. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export const nowIso = () => new Date().toISOString();
