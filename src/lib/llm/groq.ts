import Groq from "groq-sdk";
import { env, need } from "../env";
import { toLLMError, type LLMRequest, type Provider } from "./types";

let client: Groq | undefined;
const groq = () => (client ??= new Groq({ apiKey: need("GROQ_API_KEY") }));

function toParams(model: string, req: LLMRequest) {
  const system = [req.system, req.json ? "Respond with a single valid JSON object only — no prose, no code fences." : ""].filter(Boolean).join("\n\n");
  return {
    model,
    messages: [...(system ? [{ role: "system" as const, content: system }] : []), ...req.messages],
    temperature: req.temperature ?? 0.3,
    max_completion_tokens: req.maxOutputTokens,
    // json_object mode is the broadly supported option across Groq models (strict json_schema is model-limited);
    // the router validates with zod and repairs, so we don't depend on provider-side schema enforcement.
    ...(req.json ? { response_format: { type: "json_object" as const } } : {}),
  };
}

/** Groq (Llama) — very fast generation for interactive steps. Smaller window than Gemini. */
export function groqProvider(model = env().GROQ_MODEL): Provider {
  return {
    id: "groq",
    model,
    maxContextChars: env().GROQ_MAX_CONTEXT_CHARS,
    async complete(req) {
      try {
        const res = await groq().chat.completions.create(toParams(model, req), { signal: req.signal });
        return res.choices[0]?.message?.content ?? "";
      } catch (e) {
        throw toLLMError(e);
      }
    },
    async *stream(req) {
      try {
        const stream = await groq().chat.completions.create({ ...toParams(model, req), stream: true }, { signal: req.signal });
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content;
          if (t) yield t;
        }
      } catch (e) {
        throw toLLMError(e);
      }
    },
  };
}
