import { z } from "zod";
import { env } from "../../env";
import type { NodeDef } from "../context";
import { QUESTIONS_SYSTEM } from "../prompts";
import { QuestionsSchema, type ExamQuestion } from "../schemas";
import { fmtEvent, gather, safeText } from "./helpers";

const config = z.object({
  witness: z.string().max(200).optional(),
  style: z.enum(["neutral", "aggressive", "exploratory"]).default("neutral"),
  maxQuestions: z.number().int().min(5).max(200).default(60),
});

const STYLE = {
  neutral: "professional, precise, non-argumentative",
  aggressive: "confrontational cross-examination: tight leading questions, no room to explain",
  exploratory: "discovery-oriented: open-ended questions designed to learn what the witness knows",
};

export const questionsAgent: NodeDef<typeof config> = {
  type: "agent.questions",
  label: "Question Drafter",
  description: "Drafts a targeted examination outline (foundation → pin-down → impeachment) grounded in the timeline and contradictions.",
  produces: "questions",
  needsAny: ["timeline", "contradictions"],
  configSchema: config,
  async run({ config, inputs, feedback, attempt, ctx, node }) {
    const { events = [], contradictions = [] } = gather(inputs);
    const e = env();

    // Prompt budget: Groq's window is much smaller than Gemini's, so send what matters most first —
    // the contradictions, the events they cite, then as much of the remaining chronology as fits.
    const budget = Math.min(120_000, Math.floor(e.GROQ_MAX_CONTEXT_CHARS / 2));
    const byId = new Map(events.map((x) => [x.id, x]));
    const cited = [...new Set(contradictions.flatMap((c) => c.eventIds))].map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
    const citedIds = new Set(cited.map((x) => x.id));

    const contraText = contradictions.map((c) => `${c.id} [${c.severity}] ${c.title}: ${c.explanation} (events: ${c.eventIds.join(", ")}) Use: ${c.impeachmentValue}`).join("\n");
    let used = contraText.length + cited.reduce((n, x) => n + fmtEvent(x).length, 0);
    const rest: string[] = [];
    for (const ev of events) {
      if (citedIds.has(ev.id)) continue;
      const line = fmtEvent(ev);
      if (used + line.length > budget) break;
      rest.push(line);
      used += line.length;
    }
    if (rest.length + cited.length < events.length) {
      await ctx.emit({ nodeId: node.id, agent: "Question Drafter", level: "info", message: `Context trimmed to fit the fast model: ${rest.length + cited.length}/${events.length} events included (all contradiction evidence kept).` });
    }

    const witness = safeText(ctx, config.witness);
    const user = [
      contradictions.length ? `CONTRADICTIONS:\n${contraText}` : "CONTRADICTIONS: none identified — draft foundation, pin-down and exploratory questions only.",
      cited.length ? `EVIDENCE CITED BY CONTRADICTIONS:\n${cited.map(fmtEvent).join("\n")}` : "",
      rest.length ? `OTHER CHRONOLOGY:\n${rest.join("\n")}` : "",
      ctx.runInput.instructions ? `COUNSEL'S INSTRUCTIONS: ${safeText(ctx, ctx.runInput.instructions)}` : "",
      // Gate feedback: the reason this node is running again.
      feedback.length ? `REVISION REQUIRED (attempt ${attempt + 1}). Fix these problems from your previous draft:\n- ${feedback.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const out = await ctx.llm.json(
      QuestionsSchema,
      {
        system: QUESTIONS_SYSTEM({ witness, style: STYLE[config.style], max: config.maxQuestions, hasContradictions: contradictions.length > 0 }),
        messages: [{ role: "user", content: user }],
        temperature: 0.4,
        maxOutputTokens: 8_192,
      },
      // fast tier = Groq first; falls back to Gemini automatically if Groq is down or rate limited.
      { tier: "fast", where: "questions" },
    );

    // Ground the output: strip references to ids that don't exist rather than letting dangling citations through.
    const cIds = new Set(contradictions.map((c) => c.id));
    let dropped = 0;
    const questions: ExamQuestion[] = out.questions.slice(0, config.maxQuestions).map((q, i) => {
      const eventIds = q.eventIds.filter((id) => byId.has(id));
      const contradictionIds = q.contradictionIds.filter((id) => cIds.has(id));
      dropped += q.eventIds.length - eventIds.length + (q.contradictionIds.length - contradictionIds.length);
      return { ...q, eventIds, contradictionIds, id: `q_${i + 1}` };
    });

    await ctx.emit({
      nodeId: node.id,
      agent: "Question Drafter",
      level: "decision",
      message: `Drafted ${questions.length} question(s) in ${new Set(questions.map((q) => q.section)).size} section(s)${attempt ? ` (revision ${attempt})` : ""}. Removed ${dropped} dangling reference(s).`,
    });
    return { kind: "questions", data: { events, contradictions, questions } };
  },
};
