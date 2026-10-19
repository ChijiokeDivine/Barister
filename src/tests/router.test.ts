import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { LLMRouter } from "../lib/llm/router";
import { LLMError, type LLMRequest, type Provider } from "../lib/llm/types";

const mk = (id: "gemini" | "groq", model: string, impl: (r: LLMRequest, n: number) => Promise<string>, maxContextChars = 1e9): Provider & { calls: number } => {
  const p = { id, model, maxContextChars, calls: 0, complete: async (r: LLMRequest) => impl(r, p.calls++), async *stream(r: LLMRequest) { yield await impl(r, p.calls++); } };
  return p;
};
const req = (c: string): LLMRequest => ({ messages: [{ role: "user", content: c }] });
const noSleep = async () => {};

test("retries a 429 on the same provider, then succeeds", async () => {
  const a = mk("groq", "g", async (_r, n) => { if (n < 2) throw new LLMError("rate limited", true, 429); return "ok"; });
  const r = new LLMRouter({ chains: { fast: [a], long: [a] }, sleep: noSleep });
  assert.equal(await r.text(req("x")), "ok");
  assert.equal(a.calls, 3);
});

test("falls through to the next provider when the first keeps failing", async () => {
  const a = mk("groq", "g", async () => { throw new LLMError("down", true, 503); });
  const b = mk("gemini", "m", async () => "from-gemini");
  const r = new LLMRouter({ chains: { fast: [a, b], long: [b] }, sleep: noSleep });
  assert.equal(await r.text(req("x")), "from-gemini");
  assert.equal(a.calls, 4); // 1 try + 3 backoff retries, then moves on
});

test("non-retryable errors (e.g. 400/401) skip retries and fall back immediately", async () => {
  const a = mk("groq", "g", async () => { throw new LLMError("bad key", false, 401); });
  const b = mk("gemini", "m", async () => "ok");
  const r = new LLMRouter({ chains: { fast: [a, b], long: [b] }, sleep: noSleep });
  assert.equal(await r.text(req("x")), "ok");
  assert.equal(a.calls, 1);
});

test("providers whose window is too small are skipped for big prompts", async () => {
  const small = mk("groq", "g", async () => "small", 100);
  const big = mk("gemini", "m", async () => "big");
  const r = new LLMRouter({ chains: { fast: [small, big], long: [big] }, sleep: noSleep });
  assert.equal(await r.text(req("y".repeat(500))), "big");
  assert.equal(small.calls, 0);
});

test("json(): shows the model its own invalid output and gets a corrected one", async () => {
  const seen: string[] = [];
  const p = mk("gemini", "m", async (r, n) => { seen.push(r.messages.at(-1)!.content); return n === 0 ? '{"a": "not-a-number"}' : '```json\n{"a": 5}\n```'; });
  const r = new LLMRouter({ chains: { fast: [p], long: [p] }, sleep: noSleep });
  const out = await r.json(z.object({ a: z.number() }), req("go"));
  assert.deepEqual(out, { a: 5 });
  assert.match(seen[1]!, /invalid/i);
});

test("json(): gives up with a clear error after the repair budget", async () => {
  const p = mk("gemini", "m", async () => "not json at all");
  const r = new LLMRouter({ chains: { fast: [p], long: [p] }, sleep: noSleep });
  await assert.rejects(() => r.json(z.object({ a: z.number() }), req("go"), { tier: "fast", repairs: 1 }), /valid structured output/);
  assert.equal(p.calls, 2);
});

test("outbound guard runs on every message and can block the call", async () => {
  const p = mk("groq", "g", async () => "ok");
  const r = new LLMRouter({ chains: { fast: [p], long: [p] }, outbound: (t) => { if (t.includes("SECRET")) throw new Error("blocked"); return t; }, sleep: noSleep });
  await assert.rejects(() => r.text(req("contains SECRET")), /blocked/);
  assert.equal(p.calls, 0, "provider must never be called when the guard blocks");
});

test("streaming falls back only before the first token", async () => {
  const bad = { id: "groq" as const, model: "g", maxContextChars: 1e9, complete: async () => "", async *stream(): AsyncGenerator<string> { throw new LLMError("down", true, 503); } };
  const good = mk("gemini", "m", async () => "hello");
  const r = new LLMRouter({ chains: { fast: [bad, good], long: [good] }, sleep: noSleep });
  let out = "";
  for await (const c of r.stream(req("x"))) out += c;
  assert.equal(out, "hello");

  const mid = { id: "groq" as const, model: "g", maxContextChars: 1e9, complete: async () => "", async *stream(): AsyncGenerator<string> { yield "partial "; throw new LLMError("cut", true, 503); } };
  const r2 = new LLMRouter({ chains: { fast: [mid, good], long: [good] }, sleep: noSleep });
  await assert.rejects(async () => { for await (const _ of r2.stream(req("x"))); }, /interrupted/i);
});
