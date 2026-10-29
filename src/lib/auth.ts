import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { env } from "./env";
import { unauthorized } from "./errors";
import { SESSION_COOKIE } from "./auth/constants";
import { getSessionUserFromToken } from "./auth/session";
import type { SessionUser } from "./auth/types";

/** Reads one cookie without pulling in `next/headers`, so API routes stay per-request. */
function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

/**
 * Authentication for every /api/* route.
 *
 * The primary method is the signed-in browser session (HttpOnly cookie backed by
 * the `sessions` table). Machine-to-machine callers may still present the shared
 * APP_API_KEY bearer token, which exists only as an integration escape hatch.
 */
export async function requireAuth(req: Request): Promise<SessionUser | null> {
  // Every API response is per-user, so never let the build prerender one.
  await connection();

  const token = cookieValue(req.headers.get("cookie"), SESSION_COOKIE);
  const user = await getSessionUserFromToken(token).catch((error) => {
    console.error("[auth] session lookup failed", error instanceof Error ? error.message : error);
    return null;
  });
  if (user) return user;

  const expected = env().APP_API_KEY;
  if (expected) {
    const header = req.headers.get("authorization");
    const given = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : (req.headers.get("x-api-key") ?? "");
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    // Constant-time compare (length check first is unavoidable and leaks only the length).
    if (a.length === b.length && timingSafeEqual(a, b)) return null;
  }

  throw unauthorized();
}
