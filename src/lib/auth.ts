import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { unauthorized } from "./errors";

/**
 * Placeholder auth: one shared bearer key (APP_API_KEY). Deliberately simple and fail-closed — if the key isn't
 * set, EVERY request is rejected, so a forgotten env var can never expose client data. Swap `requireAuth` for a real
 * identity provider (NextAuth/Clerk) later; every route already calls it, so nothing else has to change.
 */
export function requireAuth(req: Request): void {
  const expected = env().APP_API_KEY;
  if (!expected) throw unauthorized();
  const header = req.headers.get("authorization");
  const given = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : (req.headers.get("x-api-key") ?? "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // Constant-time compare (length check first is unavoidable and leaks only the length).
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized();
}
