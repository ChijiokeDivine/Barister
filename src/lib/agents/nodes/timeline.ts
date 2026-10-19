import { z } from "zod";
import { env } from "../../env";
import { sha256Hex } from "../../hash";
import { chunkText, normForMatch, quoteInSource } from "../../ingest/chunk";
import { jaccard, mapSettled } from "../../util";
import type { NodeDef } from "../context";
import { PROMPT_VERSION, TIMELINE_SYSTEM } from "../prompts";
import { ChunkExtractionSchema, type TimelineEvent } from "../schemas";
import { gather, safeText } from "./helpers";

const config = z.object({
  maxEventsPerChunk: z.number().int().min(10).max(400).default(120),
  focus: z.string().max(500).optional(),
});

type RawEvent = Omit<TimelineEvent, "id">;

// ── date helpers ──
/** Accepts YYYY, YYYY-MM, YYYY-MM-DD (extra time parts are dropped). Anything else → null rather than a wrong date. */
export function normalizeDate(d: string | null | undefined): string | null {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec((d ?? "").trim());
  if (!m) return null;
  const [, y, mo, da] = m;
  if (mo && (Number(mo) < 1 || Number(mo) > 12)) return y!;
  if (da && (Number(da) < 1 || Number(da) > 31)) return `${y}-${mo}`;
  return [y, mo, da].filter(Boolean).join("-");
}
const sortKey = (d: string | null) => {
  if (!d) return "9999-99-99"; // undated last
  const [y, m = "01", day = "01"] = d.split("-");
  return `${y}-${m}-${day}`;
};
const precisionOf = (d: string | null): RawEvent["datePrecision"] => (!d ? "unknown" : d.length === 10 ? "day" : d.length === 7 ? "month" : "year");
const CONF = { high: 2, medium: 1, low: 0 } as const;

/**
 * Reduce step: the same event is usually extracted twice (chunk overlap, or a fact repeated across documents).
 * Merge entries with the same date and near-identical wording; keep the best-evidenced one.
 */
export function mergeEvents(raw: RawEvent[]): TimelineEvent[] {
  const groups = new Map<string, RawEvent[]>();
  const kept: RawEvent[] = [];
  for (const e of raw) {
    const key = e.date ?? `undated:${e.docId}`;
    const bucket = groups.get(key) ?? [];
    const dupIdx = bucket.findIndex((o) => jaccard(o.description, e.description) >= 0.8 || (normForMatch(o.quote) === normForMatch(e.quote) && normForMatch(e.quote).length > 20));
    if (dupIdx === -1) {
      bucket.push(e);
      groups.set(key, bucket);
      kept.push(e);
    } else {
      const o = bucket[dupIdx]!;
      const better = Number(e.verified) - Number(o.verified) || CONF[e.confidence] - CONF[o.confidence];
      const winner = better > 0 ? e : o;
      winner.actors = [...new Set([...o.actors, ...e.actors])];
      if (winner !== o) {
        bucket[dupIdx] = winner;
        kept[kept.indexOf(o)] = winner;
      }
    }
  }
  return kept
    .sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)) || a.docName.localeCompare(b.docName) || (a.page ?? 0) - (b.page ?? 0))
    .map((e, i) => ({ ...e, id: `ev_${String(i + 1).padStart(4, "0")}` }));
}

export const timelineAgent: NodeDef<typeof config> = {
  type: "agent.timeline",
  label: "Timeline Extractor",
  description: "Reads documents and transcripts and builds a sourced, chronological timeline of facts and statements.",
  produces: "timeline",
  needsAny: ["documents"],
  configSchema: config,
  async run({ config, inputs, ctx, node }) {
    const { docs = [] } = gather(inputs);
    const e = env();
    const focus = safeText(ctx, config.focus ?? ctx.runInput.instructions);

    // Doc names can contain party names ("Smith Depo.pdf") — redact before they enter any prompt.
    const jobs = docs.flatMap((doc) => {
      const safeName = ctx.redactor.redact(doc.name).text;
      const chunks = chunkText(doc.text, e.GEMINI_CHUNK_CHARS);
      return chunks.map((ch) => ({ doc, safeName, ch, total: chunks.length }));
    });
    await ctx.emit({
      nodeId: node.id,
      agent: "Timeline Extractor",
      level: "decision",
      message: `Split ${docs.length} document(s) into ${jobs.length} chunk(s) (≤${e.GEMINI_CHUNK_CHARS.toLocaleString()} chars each) for map-reduce extraction on the long-context model.`,
    });

    let done = 0;
    const settled = await mapSettled(jobs, e.LLM_CONCURRENCY, async ({ doc, safeName, ch, total }) => {
      // Cache key covers prompt version + settings + exact text → a resumed run re-pays only for failed chunks.
      const key = `tl:${await sha256Hex(`${PROMPT_VERSION}|${config.maxEventsPerChunk}|${focus ?? ""}|${doc.id}|${ch.text}`)}`;
      let events = await ctx.cacheGet<RawEvent[]>(key);
      let cached = true;
      if (!events) {
        cached = false;
        const pageNote = ch.startPage ? ` (pages ${ch.startPage}–${ch.endPage ?? ch.startPage})` : "";
        const out = await ctx.llm.json(
          ChunkExtractionSchema,
          {
            system: TIMELINE_SYSTEM(config.maxEventsPerChunk, focus),
            messages: [{ role: "user", content: `DOCUMENT: ${safeName}\nEXCERPT ${ch.index + 1} of ${total}${pageNote}\n\n${ch.text}` }],
            temperature: 0.1,
            maxOutputTokens: 32_768,
          },
          { tier: "long", where: `timeline:${doc.id}:${ch.index}` },
        );
        const hay = normForMatch(ch.text);
        events = out.events.map((ev) => {
          const date = normalizeDate(ev.date);
          return {
            ...ev,
            date,
            datePrecision: precisionOf(date),
            docId: doc.id,
            docName: safeName,
            // Anti-hallucination: a citation only counts if the quote really is in the source.
            verified: quoteInSource(ev.quote, hay),
          };
        });
        await ctx.cachePut(key, events);
      }
      done++;
      await ctx.emit({
        nodeId: node.id,
        agent: "Timeline Extractor",
        level: "info",
        message: `Chunk ${done}/${jobs.length} (${safeName} #${ch.index + 1}): ${events.length} entries${cached ? " [cached]" : ""}, ${events.filter((x) => !x.verified).length} with unverified quotes.`,
      });
      return events;
    });

    const failed = settled.filter((s) => !s.ok);
    if (failed.length) {
      // Fail loudly: a silently incomplete chronology is worse than no chronology. Finished chunks are cached,
      // so "resume" only redoes these.
      const first = failed[0] as { ok: false; error: Error };
      throw new Error(`Timeline extraction failed on ${failed.length}/${jobs.length} chunk(s): ${first.error.message}. Resume the run to retry only those chunks.`);
    }

    const raw = settled.flatMap((s) => (s.ok ? s.value : []));
    const events = mergeEvents(raw);
    const unverified = events.filter((x) => !x.verified).length;
    await ctx.emit({
      nodeId: node.id,
      agent: "Timeline Extractor",
      level: "decision",
      message: `Merged ${raw.length} raw entries into ${events.length} unique chronological events (removed ${raw.length - events.length} duplicates). ${unverified} event(s) flagged: quote not found verbatim in source.`,
    });
    return { kind: "timeline", data: { events } };
  },
};
