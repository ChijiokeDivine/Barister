#!/usr/bin/env node
/**
 * Applies db/schema.sql to the database in DIRECT_URL (or DATABASE_URL).
 *
 * Usage: pnpm db:setup
 *
 * DIRECT_URL is the session-mode Supabase connection: the right choice for
 * DDL. DATABASE_URL points at the transaction pooler, which is fine for the
 * running app but not for migrations.
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env loader so `pnpm db:setup` works without Next.js. */
function loadEnvFile(name) {
  const file = resolve(root, name);
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✖ DATABASE_URL (or DIRECT_URL) is not set. Add it to .env.local first.");
  process.exit(1);
}

const isSupabase = /supabase\.(co|com)/i.test(connectionString);

const client = new pg.Client({
  connectionString,
  ssl: process.env.PGSSLMODE === "disable" ? false : isSupabase ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  const schema = await readFile(resolve(root, "db/schema.sql"), "utf8");
  await client.query(schema);
  console.log("✔ Database schema is up to date.");
  console.log("  Tables: users, sessions");
} catch (error) {
  console.error("✖ Database setup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
