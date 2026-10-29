import { query } from "../db";
import { conflict } from "../errors";
import type { SessionUser } from "./types";

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
}

export interface UserWithPassword extends SessionUser {
  passwordHash: string;
}

const toSessionUser = (row: UserRow): SessionUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at.toISOString(),
});

/** Emails are compared case-insensitively; store the trimmed original, look up lower(email). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const { rows } = await query<UserRow>("select id, email, name, password_hash, created_at from users where lower(email) = $1 limit 1", [normalizeEmail(email)]);
  const row = rows[0];
  return row ? { ...toSessionUser(row), passwordHash: row.password_hash } : null;
}

export async function findUserById(id: string): Promise<SessionUser | null> {
  const { rows } = await query<UserRow>("select id, email, name, password_hash, created_at from users where id = $1 limit 1", [id]);
  return rows[0] ? toSessionUser(rows[0]) : null;
}

export async function createUser(input: { email: string; name: string; passwordHash: string }): Promise<SessionUser> {
  try {
    const { rows } = await query<UserRow>(
      "insert into users (email, name, password_hash) values ($1, $2, $3) returning id, email, name, password_hash, created_at",
      [input.email.trim(), input.name.trim(), input.passwordHash],
    );
    const row = rows[0];
    if (!row) throw new Error("User insert returned no row");
    return toSessionUser(row);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw conflict("An account with that email already exists");
    throw error;
  }
}
