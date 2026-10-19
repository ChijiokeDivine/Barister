import { z } from "zod";
import { env } from "../../env";
import { sha256Hex } from "../../hash";
import { chunkText, normForMatch, quoteInSource } from "../../ingest/chunk";
import { mapSettled } from "../../util";
import type { NodeDef } from "../context";
import { CONTRACT_SYSTEM, PROMPT_VERSION } from "../prompts";
import { RiskMatrixSchema, type RiskMatrix } from "../schemas";
import { gather, safeText } from "./helpers";

const config = z.object({ focus: z.string().max(500).optional() });
const RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export const contractReviewAgent: NodeDef<typeof config> = {
  type: "agent.contractReview",
  label: "Contract Risk Review",
  description: "Reviews contracts clause-by-clause against the firm's negotiation playbook and produces a risk matrix.",
  produces: "risk_matrix",
  needsAny: ["documents"],
  configSchema: config,
  async run({ config, inputs, ctx, node }) {
    const { docs = [] } = gather(inputs);
    const playbook = ctx.playbook
      .map((r) => `- ${r.clause}: preferred = ${r.preferred}${r.fallback ? `; fallback = ${r.fallback}` : ""}${r.redLine ? `; RED LINE = ${r.redLine}` : ""}`)
      .join("\n");
    // Playbook text is firm-authored and may name counterparties — keep it behind the same redaction.
    const safePlaybook = ctx.redactor.redact(playbook).text;
    const focus = safeText(ctx, config.focus ?? ctx.runInput.instructions);

    const jobs = docs.flatMap((doc) => {
      const safeName = ctx.redactor.redact(doc.name).text;
      const chunks = chunkText(doc.text, env().GEMINI_CHUNK_CHARS);
      return chunks.map((ch) => ({ doc, safeName, ch, total: chunks.length }));
    });
    await ctx.emit({ nodeId: node.id, agent: "Contract Reviewer", level: "decision", message: `Reviewing ${docs.length} contract(s) in ${jobs.length} chunk(s) against ${ctx.playbook.length} playbook rule(s).` });

    const settled = await mapSettled(jobs, env().LLM_CONCURRENCY, async ({ doc, safeName, ch, total }) => {
      const key = `cr:${await sha256Hex(`${PROMPT_VERSION}|${safePlaybook}|${focus ?? ""}|${doc.id}|${ch.text}`)}`;
      let out = await ctx.cacheGet<RiskMatrix>(key);
      if (!out) {
        out = await ctx.llm.json(
          RiskMatrixSchema,
          {
            system: CONTRACT_SYSTEM(safePlaybook) + (focus ? `\nFOCUS: ${focus}` : ""),
            messages: [{ role: "user", content: `CONTRACT: ${safeName}\nEXCERPT ${ch.index + 1} of ${total}\n\n${ch.text}` }],
            temperature: 0.1,
            maxOutputTokens: 16_000,
          },
          { tier: "long", where: `contract:${doc.id}:${ch.index}` },
        );
        await ctx.cachePut(key, out);
      }
      const hay = normForMatch(ch.text);
      return { ...out, clauses: out.clauses.map((c) => ({ ...c, location: c.location ?? safeName, quote: quoteInSource(c.quote, hay) ? c.quote : `${c.quote} [unverified quote]` })) };
    });

    const failed = settled.filter((s) => !s.ok);
    if (failed.length) throw new Error(`Contract review failed on ${failed.length}/${jobs.length} chunk(s): ${(failed[0] as { error: Error }).error.message}`);

    const parts = settled.flatMap((s) => (s.ok ? [s.value] : []));
    const riskMatrix: RiskMatrix = {
      summary: parts.map((p) => p.summary).filter(Boolean).join(" "),
      clauses: parts.flatMap((p) => p.clauses).sort((a, b) => RANK[a.riskLevel] - RANK[b.riskLevel]),
    };
    await ctx.emit({
      nodeId: node.id,
      agent: "Contract Reviewer",
      level: "decision",
      message: `Risk matrix: ${riskMatrix.clauses.length} clause(s) — ${riskMatrix.clauses.filter((c) => c.riskLevel === "critical").length} critical, ${riskMatrix.clauses.filter((c) => c.riskLevel === "high").length} high.`,
    });
    return { kind: "risk_matrix", data: { riskMatrix } };
  },
};
