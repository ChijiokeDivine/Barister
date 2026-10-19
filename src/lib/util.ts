/** Run `fn` over items with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Like mapLimit but never rejects: collects per-item failures so callers can decide what a partial result means. */
export async function mapSettled<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  return mapLimit(items, limit, async (item, i) => {
    try {
      return { ok: true as const, value: await fn(item, i), index: i };
    } catch (error) {
      return { ok: false as const, error: error as Error, index: i };
    }
  });
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));

/** Word-set Jaccard similarity in [0,1] — cheap near-duplicate detector for event descriptions. */
export function jaccard(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
