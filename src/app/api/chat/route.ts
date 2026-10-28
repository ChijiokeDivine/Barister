import { z } from "zod";
import { parseBody, route, sse } from "@/lib/api";
import { chatTurn } from "@/lib/services/chat";

export const maxDuration = 120;

const Body = z.object({
  message: z.string().min(1).max(20_000),
  conversationId: z.string().optional(),
  caseId: z.string().nullish(),
  /** Documents (from the vault) attached to this conversation. Sent redacted to the model. */
  docIds: z.array(z.string()).max(50).optional(),
  /** Explicit model routing; "auto" keeps the server-side heuristic. */
  tier: z.enum(["auto", "long", "fast"]).optional(),
  /** Grounding sources the attorney enabled. */
  sources: z.array(z.enum(["vault", "playbooks", "web", "caselaw"])).max(4).optional(),
});

/**
 * Chat turn over SSE. Events: meta {conversationId} → status? → delta {text}* | workflow {name,description,graph} → done | error.
 * A "workflow" event means the user asked to build a pipeline; the UI drops the graph onto the canvas.
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, Body, 100_000);
  return sse((send, signal) => chatTurn(body, send, signal));
});
