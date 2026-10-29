import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "../db";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";
import type { SessionUser } from "./types";

interface SessionRow {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

/** Never store the raw token: the database only sees a one-way hash. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a fresh server-side session and puts the opaque token in an HttpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Opportunistic cleanup; sending an expired row is also filtered on read.
  await query("delete from sessions where expires_at <= now()");
  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(token), userId, expiresAt]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Reads the session cookie and verifies it against the database. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUserFromToken(token);
}

/** Verifies a raw session token. Route handlers use this with the request's Cookie header. */
export async function getSessionUserFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await query<SessionRow>(
    `select u.id, u.email, u.name, u.created_at
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1`,
    [hashToken(token)],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, name: row.name, createdAt: row.created_at.toISOString() } : null;
}

/** Deletes the current session (server-side) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  cookieStore.delete(SESSION_COOKIE);
}
