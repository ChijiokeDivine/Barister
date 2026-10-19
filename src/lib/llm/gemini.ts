import { GoogleGenAI } from "@google/genai";
import { env, need } from "../env";
import { toLLMError, type LLMRequest, type Provider } from "./types";

let client: GoogleGenAI | undefined;
const ai = () => (client ??= new GoogleGenAI({ apiKey: need("GEMINI_API_KEY") }));

function toParams(model: string, req: LLMRequest) {
  return {
    model,
    // Gemini calls the assistant role "model".
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    config: {
      systemInstruction: req.system,
      temperature: req.temperature ?? 0.2, // low by default: extraction/analysis should be repeatable
      maxOutputTokens: req.maxOutputTokens,
      abortSignal: req.signal,
      ...(req.json ? { responseMimeType: "application/json", ...(req.json.schema ? { responseJsonSchema: req.json.schema } : {}) } : {}),
    },
  };
}

/** Gemini via Google AI Studio — long-context workhorse (free tier ≈ 1M-token window). */
export function geminiProvider(model = env().GEMINI_MODEL): Provider {
  return {
    id: "gemini",
    model,
    maxContextChars: 3_500_000, // ~900k tokens, leaving headroom under the 1M window
    async complete(req) {
      try {
        const res = await ai().models.generateContent(toParams(model, req));
        return res.text ?? "";
      } catch (e) {
        throw toLLMError(e);
      }
    },
    async *stream(req) {
      try {
        const stream = await ai().models.generateContentStream(toParams(model, req));
        for await (const chunk of stream) if (chunk.text) yield chunk.text;
      } catch (e) {
        throw toLLMError(e);
      }
    },
  };
}
