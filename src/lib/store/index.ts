/**
 * Store entry point + sealed helpers.
 *
 * Convention: anything that can contain client information (document text, vault maps, chats, outputs,
 * run artifacts) goes through the `sealed*` helpers → AES-GCM ciphertext. Plain `kv.put` is for metadata only
 * (ids, names, hashes, timestamps, statuses).
 */
import { decrypt, encrypt, openJSON, sealJSON } from "../crypto";
import { env } from "../env";
import { notConfigured } from "../errors";
import { cloudStore } from "./cloud";
import { fileStore } from "./file";
import type { Store } from "./types";

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const e = env();
  const cloudReady = Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN && e.BLOB_READ_WRITE_TOKEN);
  const driver = e.STORAGE_DRIVER ?? (cloudReady ? "cloud" : "file");
  // Vercel's filesystem is ephemeral: a "file" driver there would silently lose legal data. Fail loudly.
  if (driver === "file" && process.env.VERCEL) {
    throw notConfigured("Persistent storage (set UPSTASH_REDIS_REST_URL/TOKEN and BLOB_READ_WRITE_TOKEN)");
  }
  if (driver === "cloud" && !cloudReady) throw notConfigured("Cloud storage credentials");
  return (store = driver === "cloud" ? cloudStore() : fileStore());
}

export const kv = () => getStore().kv;
export const blobs = () => getStore().blobs;

// ── Sealed records: JSON encrypted into a single field ({ v: ciphertext }) ──
export async function putSealed(collection: string, id: string, value: unknown): Promise<void> {
  await kv().put(collection, id, { v: sealJSON(value) });
}
export async function getSealed<T>(collection: string, id: string): Promise<T | null> {
  const row = await kv().get<{ v: string }>(collection, id);
  return row ? openJSON<T>(row.v) : null;
}

// ── Sealed blobs ──
export const putBlob = (key: string, data: Buffer) => blobs().put(key, encrypt(data));
export async function getBlob(key: string): Promise<Buffer | null> {
  const raw = await blobs().get(key);
  return raw ? decrypt(raw) : null;
}
export const putBlobText = (key: string, text: string) => putBlob(key, Buffer.from(text, "utf8"));
export async function getBlobText(key: string): Promise<string | null> {
  const buf = await getBlob(key);
  return buf ? buf.toString("utf8") : null;
}
export const delBlob = (key: string) => blobs().del(key);

export type { Store, KV, Blobs } from "./types";
