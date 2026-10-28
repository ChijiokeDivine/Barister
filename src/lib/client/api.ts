/**
 * Browser API client. Every route returns `{ data }` or `{ error }`; this unwraps that
 * contract and surfaces typed failures so components never parse ad-hoc shapes.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || body?.error) {
    throw new ApiError(res.status, body?.error?.code ?? "request_failed", body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details);
  }
  return body?.data as T;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  return parse<T>(res);
}

export interface SseHandlers {
  onEvent: (event: string, data: unknown) => void;
  onError?: (error: ApiError) => void;
  signal?: AbortSignal;
}

/** Streams a Server-Sent Events response (works for both POST bodies and GET cursors). */
export async function sse(path: string, init: RequestInit & { json?: unknown }, handlers: SseHandlers): Promise<void> {
  const { json, headers, ...rest } = init;
  try {
    const res = await fetch(path, {
      ...rest,
      headers: { Accept: "text/event-stream", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      signal: handlers.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      try {
        await parse<never>(res);
      } catch (e) {
        handlers.onError?.(e as ApiError);
      }
      return;
    }
    if (!res.body) throw new ApiError(502, "no_stream", "The server returned an empty stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf("\n\n");
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith(":")) continue;
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (data.length) {
          const raw = data.join("\n");
          let parsed: unknown = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* plain text frame */
          }
          handlers.onEvent(event, parsed);
        }
      }
    }
  } catch (e) {
    if (handlers.signal?.aborted) return;
    handlers.onError?.(e instanceof ApiError ? e : new ApiError(0, "network_error", e instanceof Error ? e.message : "Stream failed"));
  }
}

/** SHA-256 of a file, computed in the browser so the server can verify transit integrity. */
export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
