/**
 * LLM router: one place that decides WHICH model handles a call and HOW it's made safe.
 *
 *  - Tiering:   "long" → Gemini (huge context), "fast" → Groq (low latency). Each tier has a fallback chain.
 *  - Resilience: retry w/ backoff on 429/5xx, then fall through the chain (free tiers are flaky and rate limited).
 *  - Throttle:  per-provider concurrency gate so parallel agent steps don't trip free-tier rate limits.
 *  - Privacy:   every outbound string passes through `outbound()` — the last-line leak guard (see engine).
 *  - Validity:  json() validates with zod and asks the model to repair its own output before giving up.
 */
import { z } from "zod";
import { env } from "../env";
import { notConfigured, upstream } from "../errors";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { LLMError, toLLMError, type ChatMsg, type LLMRequest, type Provider, type Tier } from "./types";

export interface LLMEvent {
  provider: string;
  model: string;
  tier: Tier;
  attempt: number;
  ms?: number;
  promptChars: number;
  error?: string;
  note?: string;
}

export interface RouterOptions {
  chains?: Record<Tier, Provider[]>;
  /** Applied to every outbound string. Returns the (possibly scrubbed) text. */
  outbound?: (text: string, where: string) => string;
  onEvent?: (e: LLMEvent) => void;
  concurrency?: number;
  /** Test hook: skip real sleeping between retries. */
  sleep?: (ms: number) => Promise<void>;
}

// ── tiny semaphore (shared per provider id for the whole process) ──
class Semaphore {
  private waiting: (() => void)[] = [];
  private active = 0;
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((res) => this.waiting.push(res));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
const g = globalThis as unknown as { __lfGates?: Map<string, Semaphore> };
const gate = (id: string, max: number) => {
  const gates = (g.__lfGates ??= new Map());
  let s = gates.get(id);
  if (!s) gates.set(id, (s = new Semaphore(max)));
  return s;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BACKOFF_MS = [1_500, 5_000, 15_000];

/** Default provider chains, silently skipping providers whose API key isn't configured. */
export function defaultChains(): Record<Tier, Provider[]> {
  const e = env();
  const gemini = e.GEMINI_API_KEY ? [geminiProvider(e.GEMINI_MODEL), geminiProvider(e.GEMINI_FALLBACK_MODEL)] : [];
  const groq = e.GROQ_API_KEY ? [groqProvider(e.GROQ_MODEL)] : [];
  return {
    long: [...gemini, ...groq], // Groq last: only fits if the prompt is small enough (checked per request)
    fast: [...groq, ...gemini.slice(1)],
  };
}

export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    // Models occasionally wrap JSON in prose; take the outermost object/array.
    const start = t.search(/[{[]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new SyntaxError("No JSON found in model output");
  }
}

export class LLMRouter {
  private chains: Record<Tier, Provider[]>;
  private sleep: (ms: number) => Promise<void>;
  private conc: number;

  constructor(private opts: RouterOptions = {}) {
    this.chains = opts.chains ?? defaultChains();
    this.sleep = opts.sleep ?? defaultSleep;
    this.conc = opts.concurrency ?? env().LLM_CONCURRENCY;
  }

  private guard(req: LLMRequest, where: string): LLMRequest {
    const out = this.opts.outbound;
    if (!out) return req;
    return {
      ...req,
      system: req.system ? out(req.system, `${where}:system`) : req.system,
      messages: req.messages.map((m, i) => ({ ...m, content: out(m.content, `${where}:msg${i}`) })),
    };
  }

  private candidates(tier: Tier, req: LLMRequest): Provider[] {
    const size = (req.system?.length ?? 0) + req.messages.reduce((n, m) => n + m.content.length, 0);
    const fits = this.chains[tier].filter((p) => size <= p.maxContextChars);
    if (!fits.length) {
      if (!this.chains[tier].length) throw notConfigured("An LLM provider (set GEMINI_API_KEY and/or GROQ_API_KEY)");
      throw upstream(`Prompt (${size} chars) exceeds every available model's context window`);
    }
    return fits;
  }

  /** Plain text completion with retry + fallback. */
  async text(req: LLMRequest, o: { tier: Tier; where?: string } = { tier: "fast" }): Promise<string> {
    const safe = this.guard(req, o.where ?? "text");
    const promptChars = (safe.system?.length ?? 0) + safe.messages.reduce((n, m) => n + m.content.length, 0);
    let lastErr: LLMError | undefined;

    for (const p of this.candidates(o.tier, safe)) {
      for (let attempt = 0; attempt < BACKOFF_MS.length + 1; attempt++) {
        const t0 = Date.now();
        try {
          const out = await gate(p.id, this.conc).run(() => p.complete(safe));
          this.opts.onEvent?.({ provider: p.id, model: p.model, tier: o.tier, attempt, ms: Date.now() - t0, promptChars });
          return out;
        } catch (e) {
          const err = toLLMError(e);
          lastErr = err;
          this.opts.onEvent?.({ provider: p.id, model: p.model, tier: o.tier, attempt, ms: Date.now() - t0, promptChars, error: err.message.slice(0, 200) });
          if (!err.retryable || safe.signal?.aborted) break; // permanent error (bad request/auth): next provider
          if (attempt < BACKOFF_MS.length) await this.sleep(err.retryAfterMs ?? BACKOFF_MS[attempt]!);
        }
      }
    }
    throw upstream(`All models failed: ${lastErr?.message ?? "unknown error"}`, { status: lastErr?.status });
  }

  /** Streaming completion. Falls back only BEFORE the first token (can't un-send text already streamed). */
  async *stream(req: LLMRequest, o: { tier: Tier; where?: string } = { tier: "fast" }): AsyncGenerator<string> {
    const safe = this.guard(req, o.where ?? "stream");
    let lastErr: LLMError | undefined;
    for (const p of this.candidates(o.tier, safe)) {
      let started = false;
      try {
        const it = p.stream(safe);
        for await (const chunk of it) {
          started = true;
          yield chunk;
        }
        return;
      } catch (e) {
        lastErr = toLLMError(e);
        this.opts.onEvent?.({ provider: p.id, model: p.model, tier: o.tier, attempt: 0, promptChars: 0, error: lastErr.message.slice(0, 200) });
        if (started) throw upstream("Stream interrupted", { message: lastErr.message });
      }
    }
    throw upstream(`All models failed: ${lastErr?.message ?? "unknown error"}`);
  }

  /**
   * Structured output: validated against a zod schema. On invalid JSON/shape we show the model its own output
   * plus the validation errors and ask for a corrected version (cheaper and more reliable than blind retries).
   */
  async json<S extends z.ZodType>(
    schema: S,
    req: LLMRequest,
    o: { tier: Tier; where?: string; repairs?: number } = { tier: "fast" },
  ): Promise<z.infer<S>> {
    const { $schema: _omit, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
    void _omit;
    const schemaText = JSON.stringify(jsonSchema);
    const base: LLMRequest = {
      ...req,
      json: { schema: jsonSchema },
      // Always describe the schema in the prompt too: Groq can't enforce it, and Gemini may be the fallback target.
      system: `${req.system ?? ""}\n\nReturn JSON that conforms exactly to this JSON Schema:\n${schemaText}`.trim(),
    };

    const messages: ChatMsg[] = [...req.messages];
    const maxRepairs = o.repairs ?? 2;
    let lastIssue = "";
    for (let i = 0; i <= maxRepairs; i++) {
      const raw = await this.text({ ...base, messages }, { tier: o.tier, where: o.where ?? "json" });
      try {
        const parsed = schema.safeParse(parseJsonLoose(raw));
        if (parsed.success) return parsed.data;
        lastIssue = parsed.error.issues.slice(0, 8).map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`).join("; ");
      } catch (e) {
        lastIssue = `Invalid JSON: ${(e as Error).message}`;
      }
      messages.push({ role: "assistant", content: raw.slice(0, 20_000) }, { role: "user", content: `That output was invalid (${lastIssue}). Return ONLY the corrected JSON.` });
    }
    throw upstream("Model could not produce valid structured output", { issues: lastIssue });
  }
}
