import { z } from "zod";
import { badRequest } from "../../errors";
import type { NodeDef } from "../context";

const config = z.object({
  /** Limit to specific documents. Omitted → the run's selection, else every document in the matter. */
  docIds: z.array(z.string()).max(500).optional(),
});

/**
 * Pipeline entry point. Documents arrive ALREADY redacted from the vault (loadDocuments), so redaction is
 * structural: there is no node an author could forget to add, and no path from raw text to a model.
 */
export const sourceDocuments: NodeDef<typeof config> = {
  type: "source.documents",
  label: "Documents",
  description: "Loads matter documents (always PII-redacted) as the pipeline input.",
  produces: "documents",
  needsAny: [],
  isSource: true,
  configSchema: config,
  async run({ config, ctx, node }) {
    const docs = await ctx.loadDocuments(config.docIds ?? ctx.runInput.docIds);
    if (!docs.length) throw badRequest("No documents to process. Upload documents to the matter or pick some for this run.");
    const chars = docs.reduce((n, d) => n + d.text.length, 0);
    await ctx.emit({
      nodeId: node.id,
      agent: "Document Loader",
      level: "decision",
      message: `Loaded ${docs.length} document(s), ${chars.toLocaleString()} chars of redacted text. Raw text is never sent to a model.`,
    });
    return { kind: "documents", data: { docs } };
  },
};
