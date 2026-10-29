import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";
import { notConfigured } from "./errors";

/**
 * Postgres pool for account + session data. The workspace itself still lives in
 * the encrypted KV store; this connection is deliberately limited to auth.
 *
 * DATABASE_URL should point at the pooled (transaction-mode) connection for the
 * app. DDL runs through DIRECT_URL in scripts/db-setup.mjs.
 */
const globalPool = globalThis as unknown as { __baristerPool?: Pool };

function sslFor(connectionString: string): false | { rejectUnauthorized: boolean } | undefined {
  const mode = process.env.PGSSLMODE;
  if (mode === "disable") return false;
  if (mode === "require" || mode === "no-verify") return { rejectUnauthorized: false };
  // Managed providers (Supabase/Neon) terminate TLS with their own CA chain.
  if (/(^|\.)(supabase\.(co|com)|neon\.tech)/i.test(connectionString)) return { rejectUnauthorized: false };
  return undefined;
}

export function getPool(): Pool {
  if (globalPool.__baristerPool) return globalPool.__baristerPool;
  const connectionString = env().DATABASE_URL;
  if (!connectionString) throw notConfigured("DATABASE_URL");
  const pool = new Pool({
    connectionString,
    ssl: sslFor(connectionString),
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // A pooled client can drop while idle; keep the process alive and let the
  // next query open a fresh connection instead of crashing the request.
  pool.on("error", (err) => console.error("[db] idle client error", err.message));
  // Survive dev hot reloads without leaking a new pool per module instance.
  globalPool.__baristerPool = pool;
  return pool;
}

export function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
