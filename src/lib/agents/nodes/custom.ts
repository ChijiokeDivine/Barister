import { z } from "zod";
import { env } from "../../env";
import { truncate } from "../../util";
import type { NodeDef } from "../context";
import { CUSTOM_SYSTEM } from "../prompts";
import { fmtEvent, gather, safeText } from "./helpers";

const config = z.object({
  name: z.string().min(1).max(60).default("Custom Agent"),
  /** What this agent should do — this is how chat-generated workflows express bespoke steps. */
  instruction: z.string().min(5).max(4000),
  tier: z.enum(["long", "fast"]).default("fast"),
});

/** Free-form agent: lets users (or the chat) add bespoke reasoning steps without new code. */
export const customAgent: NodeDef<typeof config> = {
  type: "agent.custom",
  label: "Custom Agent",
  description: "Runs a free-form instruction over whatever is wired into it (documents, timeline, findings…).",
  produces: "text",
  needsAny: [],
  configSchema: config,
  async run({ config, inputs, ctx, node }) {
    const b = gather(inputs);
    // Budget by tier: Groq's window is small; Gemini can take far more.
    const budget = config.tier === "long" ? 900_000 : Math.floor(env().GROQ_MAX_CONTEXT_CHARS * 0.6);

    const parts: string[] = [];
    if (b.docs?.length) for (const d of b.docs) parts.push(`DOCUMENT ${ctx.redactor.redact(d.name).text}:\n${d.text}`);
    if (b.events?.length) parts.push(`CHRONOLOGY:\n${b.events.map(fmtEvent).join("\n")}`);
    if (b.contradictions?.length) parts.push(`CONTRADICTIONS:\n${JSON.stringify(b.contradictions)}`);
    if (b.questions?.length) parts.push(`QUESTIONS:\n${b.questions.map((q) => `${q.id}: ${q.text}`).join("\n")}`);
    if (b.riskMatrix) parts.push(`RISK MATRIX:\n${JSON.stringify(b.riskMatrix)}`);
    if (b.text) parts.push(`PRIOR OUTPUT:\n${b.text}`);
    const context = truncate(parts.join("\n\n---\n\n"), budget);

    const extra = safeText(ctx, ctx.runInput.instructions);
    const text = await ctx.llm.text(
      {
        system: CUSTOM_SYSTEM(config.name, ctx.redactor.redact(config.instruction).text),
        messages: [{ role: "user", content: `${context || "(no input provided)"}${extra ? `\n\nADDITIONAL INSTRUCTIONS FROM COUNSEL: ${extra}` : ""}` }],
        temperature: 0.3,
        maxOutputTokens: 8_192,
      },
      { tier: config.tier, where: `custom:${node.id}` },
    );
    await ctx.emit({ nodeId: node.id, agent: config.name, level: "decision", message: `Completed with ${context.length.toLocaleString()} chars of context${context.length >= budget ? " (truncated to fit the model)" : ""}.` });
    return { kind: "text", data: { ...b, docs: undefined, text } };
  },
};
