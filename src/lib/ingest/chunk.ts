/**
 * Chunking for map-reduce extraction. Chunks are sized for Gemini's per-request budget (free-tier TPM is the real
 * limit, not the 1M window), cut on page/paragraph boundaries, and carry a small overlap so an event straddling a
 * boundary is still seen whole in one chunk (duplicates are merged later).
 */

export interface TextChunk {
  index: number;
  text: string;
  startPage: number | null;
  endPage: number | null;
}

const MARKER_RX = /\[\[PAGE (\d+)\]\]/g;

function pageIndex(text: string): { pos: number; page: number }[] {
  return [...text.matchAll(MARKER_RX)].map((m) => ({ pos: m.index!, page: Number(m[1]) }));
}

/** Last page marker at or before `offset` (binary search). */
function pageAt(markers: { pos: number; page: number }[], offset: number): number | null {
  let lo = 0;
  let hi = markers.length - 1;
  let ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (markers[mid]!.pos <= offset) {
      ans = markers[mid]!.page;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function chunkText(text: string, maxChars: number, overlapChars = 1_500): TextChunk[] {
  if (text.length <= maxChars) {
    const m = pageIndex(text);
    return [{ index: 0, text, startPage: pageAt(m, 0) ?? m[0]?.page ?? null, endPage: pageAt(m, text.length) }];
  }
  const markers = pageIndex(text);
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      // Prefer a page boundary, then a paragraph break, then a line break; only hard-cut as a last resort.
      const floor = start + Math.floor(maxChars * 0.6);
      const page = text.lastIndexOf("[[PAGE ", end);
      const para = text.lastIndexOf("\n\n", end);
      const line = text.lastIndexOf("\n", end);
      end = [page, para, line].find((p) => p > floor) ?? end;
    }
    const slice = text.slice(start, end);
    chunks.push({
      index: chunks.length,
      text: slice,
      startPage: pageAt(markers, start) ?? markers.find((m) => m.pos >= start)?.page ?? null,
      endPage: pageAt(markers, end - 1),
    });
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks;
}

/** Normalised form for verbatim-quote checks: ignore case, punctuation and whitespace differences. */
export const normForMatch = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** True if `quote` appears (modulo formatting) in `haystackNorm` (a normForMatch'd string). Guards against hallucinated citations. */
export function quoteInSource(quote: string, haystackNorm: string): boolean {
  const q = normForMatch(quote);
  return q.length >= 8 && haystackNorm.includes(q);
}
