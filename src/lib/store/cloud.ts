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
    // We store pre-serialised JSON strings; auto-deserialisation would turn some back into objects unpredictably.
    automaticDeserialization: false,
  }));

const col = (c: string) => `lf:c:${c}`;

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
    const all = await r().hgetall<Record<string, string>>(col(c));
    return Object.values(all ?? {}).map((s) => JSON.parse(s) as T);
  },
  async hset(key, fields) {
    if (Object.keys(fields).length) await r().hset(`lf:h:${key}`, fields);
  },
  async hgetall(key) {
    return (await r().hgetall<Record<string, string>>(`lf:h:${key}`)) ?? {};
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
