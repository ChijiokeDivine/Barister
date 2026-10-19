export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system?: string;
  messages: ChatMsg[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask the provider for JSON. `schema` (JSON Schema) is enforced natively by Gemini; Groq gets it via the prompt. */
  json?: { schema?: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface Provider {
  id: "gemini" | "groq";
  model: string;
  /** Rough prompt ceiling in characters (~4 chars/token) used to skip providers that can't fit a request. */
  maxContextChars: number;
  complete(req: LLMRequest): Promise<string>;
  stream(req: LLMRequest): AsyncGenerator<string>;
}

/**
 * long = big-context, accuracy-first (Gemini): timeline extraction, contradiction analysis.
 * fast = latency-first (Groq): chat, question drafting, workflow generation.
 */
export type Tier = "long" | "fast";

export class LLMError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/** Normalises SDK errors (they differ per provider) into retryable / not. */
export function toLLMError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;
  const e = err as { status?: number; code?: number | string; message?: string; headers?: Record<string, string> };
  const status = typeof e?.status === "number" ? e.status : typeof e?.code === "number" ? e.code : undefined;
  const msg = e?.message ?? String(err);
  // 429 = rate limit (free tiers hit this constantly), 5xx = provider hiccup, no status = network/abort-ish.
  const retryable = status === 429 || (status !== undefined && status >= 500) || status === undefined || /ECONNRESET|ETIMEDOUT|fetch failed|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(msg);
  const ra = Number(e?.headers?.["retry-after"]);
  return new LLMError(msg, retryable && !/aborted/i.test(msg), status, Number.isFinite(ra) ? ra * 1000 : undefined);
}
