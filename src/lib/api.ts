/**
 * Route helpers: every handler goes through `route()` so auth, error mapping and JSON shape are uniform.
 *
 * Response contract for the frontend:
 *   success → { data: ... }            (HTTP 2xx)
 *   failure → { error: { code, message, details? } }   (HTTP 4xx/5xx)
 */
import { z, ZodError } from "zod";
import { requireAuth } from "./auth";
import { ApiError, badRequest } from "./errors";

type Params = Record<string, string>;
type Handler<P extends Params> = (req: Request, ctx: { params: P }) => Promise<unknown>;

const NO_STORE = { "Cache-Control": "no-store" }; // legal data must never be cached by browsers/CDNs

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json({ data }, { status, headers: { ...NO_STORE, ...headers } });

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return Response.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status, headers: NO_STORE });
  if (e instanceof ZodError) {
    return Response.json({ error: { code: "validation_error", message: "Invalid request", details: z.treeifyError(e) } }, { status: 400, headers: NO_STORE });
  }
  // Never echo internal error text to clients for unknown failures (may contain data); log server-side only.
  console.error("[api] unhandled", e instanceof Error ? e.stack : e);
  return Response.json({ error: { code: "internal_error", message: "Internal server error" } }, { status: 500, headers: NO_STORE });
}

/** Wraps a handler: auth → run → JSON. Return a Response to take full control (streams, file downloads). */
export function route<P extends Params = Params>(handler: Handler<P>, opts: { auth?: boolean } = {}) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      if (opts.auth !== false) requireAuth(req);
      const out = await handler(req, { params: await ctx.params });
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S, maxBytes = 1_000_000): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body too large");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

/** Server-Sent Events helper: returns a Response plus a typed `send`. Heartbeats keep proxies from closing idle streams. */
export function sse(run: (send: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>): Response {
  const enc = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const beat = setInterval(() => !closed && controller.enqueue(enc.encode(": ping\n\n")), 15_000);
      try {
        await run(send, abort.signal);
      } catch (e) {
        if (!abort.signal.aborted) {
          const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "internal_error", message: "Stream failed" };
          if (!(e instanceof ApiError)) console.error("[sse]", e);
          send("error", err);
        }
      } finally {
        closed = true;
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          /* already closed by client abort */
        }
      }
    },
    cancel() {
      abort.abort(); // client went away → stop paying for LLM tokens
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}

export const idParam = z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/);
