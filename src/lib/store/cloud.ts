/**
 * Production driver for Vercel: Upstash Redis for metadata, Vercel Blob (private) for encrypted bodies.
 * Why not Postgres: no schema/migration overhead for an early product, and both services have free tiers.
 * Why Blob for bodies: Redis request size caps (~1MB on free) can't hold transcripts of thousands of pages.
 */
import { Redis } from "@upstash/redis";
import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";
import { need } from "../env";
import type { Blobs, KV, Store } from "./types";

let redis: Redis | undefined;
const r = () =>
  (redis ??= new Redis({
    url: need("UPSTASH_REDIS_REST_URL"),
    token: need("UPSTASH_REDIS_REST_TOKEN"),
    // We store pre-serialised JSON strings, so the SDK must not parse them for us. Note this also
    // switches off command-level shaping (HGETALL → object), which `rows()` below puts back.
    automaticDeserialization: false,
  }));

const col = (c: string) => `lf:c:${c}`;

/**
 * `automaticDeserialization: false` disables every command's result transform, not just JSON parsing —
 * so HGETALL comes back as Upstash's flat wire form `[field, value, field, value, …]` instead of an object.
 * Normalise it here so callers get the plain map they're typed for.
 */
function rows(raw: unknown): Record<string, string> {
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (let i = 0; i < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
    return out;
  }
  return (raw as Record<string, string> | null) ?? {};
}

const kv: KV = {
  async get<T>(c: string, id: string) {
    const raw = await r().hget<string>(col(c), id);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async put(c, id, value) {
    await r().hset(col(c), { [id]: JSON.stringify(value) });
  },
  async del(c, id) {
    await r().hdel(col(c), id);
  },
  async list<T>(c: string) {
    const all = rows(await r().hgetall<Record<string, unknown>>(col(c)));
    const out: T[] = [];
    for (const [id, raw] of Object.entries(all)) {
      try {
        out.push(JSON.parse(raw) as T);
      } catch {
        // One unreadable row must not 500 every page that lists this collection.
        console.error(`[store] skipping unparseable record ${col(c)}/${id}`);
      }
    }
    return out;
  },
  async hset(key, fields) {
    if (Object.keys(fields).length) await r().hset(`lf:h:${key}`, fields);
  },
  async hgetall(key) {
    return rows(await r().hgetall<Record<string, unknown>>(`lf:h:${key}`));
  },
  async delKey(key) {
    await r().del(`lf:h:${key}`, `lf:l:${key}`);
  },
  async rpush(key, values) {
    if (values.length) await r().rpush(`lf:l:${key}`, ...values);
  },
  async lrange(key, start, end = -1) {
    return r().lrange<string>(`lf:l:${key}`, start, end);
  },
};

const blobs: Blobs = {
  async put(key, data) {
    // Deterministic pathname (no random suffix) so we can address it by key; overwrite for re-redaction.
    await blobPut(key, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
  },
  async get(key) {
    // useCache:false — redaction results can be rewritten, and stale ciphertext would be a correctness bug.
    const res = await blobGet(key, { access: "private", useCache: false }).catch(() => null);
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  },
  async del(key) {
    await blobDel(key).catch(() => undefined);
  },
};

export const cloudStore = (): Store => ({ kv, blobs, driver: "cloud" });
