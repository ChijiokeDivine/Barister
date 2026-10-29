import { z } from "zod";
import { notConfigured } from "./errors";

// Everything is optional at parse time so one missing key (e.g. no Sepolia key) only disables
// that feature instead of crashing the whole app. Use need() where a key is mandatory.
const schema = z.object({
  APP_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  VAULT_ENCRYPTION_KEY: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_FAST_MODEL: z.string().default("openai/gpt-oss-20b"),
  LLM_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  GEMINI_CHUNK_CHARS: z.coerce.number().int().min(20_000).default(240_000),
  GROQ_MAX_CONTEXT_CHARS: z.coerce.number().int().min(10_000).default(300_000),

  SEPOLIA_RPC_URL: z.string().url().default("https://ethereum-sepolia-rpc.publicnode.com"),
  ANCHOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex key").optional(),

  STORAGE_DRIVER: z.enum(["file", "cloud"]).optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().min(1).default(4),
  MAX_LARGE_UPLOAD_MB: z.coerce.number().min(1).default(50),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    // `KEY=` lines in .env files arrive as "" — treat them as unset so defaults/optionals apply.
    const cleaned = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "" && v !== undefined));
    cached = schema.parse(cleaned);
  }
  return cached;
}

/** Test hook: re-read process.env on next env() call. */
export function resetEnvCache() {
  cached = undefined;
}

/** Returns a required string setting or throws a 503 naming the missing key. */
export function need<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const v = env()[key];
  if (v === undefined || v === null) throw notConfigured(String(key));
  return v as NonNullable<Env[K]>;
}
