/**
 * Tiny typed repositories over the KV store.
 *  - sealedRepo: whole record AES-GCM encrypted (anything that may contain client info: names, filenames, instructions).
 *  - plainRepo : metadata only (hashes, statuses, timestamps).
 * Records always carry `id`; list() sorts newest-first by `createdAt` (ISO strings sort lexicographically).
 */
import { openJSON, sealJSON } from "../crypto";
import { kv } from "./index";

export interface Repo<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  put(rec: T): Promise<T>;
  del(id: string): Promise<void>;
  list(): Promise<T[]>;
}

const newestFirst = <T extends { createdAt?: string }>(a: T, b: T) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

export function sealedRepo<T extends { id: string; createdAt?: string }>(collection: string): Repo<T> {
  return {
    async get(id) {
      const row = await kv().get<{ v: string }>(collection, id);
      return row ? openJSON<T>(row.v) : null;
    },
    async put(rec) {
      await kv().put(collection, rec.id, { v: sealJSON(rec) });
      return rec;
    },
    del: (id) => kv().del(collection, id),
    async list() {
      return (await kv().list<{ v: string }>(collection)).map((r) => openJSON<T>(r.v)).sort(newestFirst);
    },
  };
}

export function plainRepo<T extends { id: string; createdAt?: string }>(collection: string): Repo<T> {
  return {
    get: (id) => kv().get<T>(collection, id),
    async put(rec) {
      await kv().put(collection, rec.id, rec);
      return rec;
    },
    del: (id) => kv().del(collection, id),
    async list() {
      return (await kv().list<T>(collection)).sort(newestFirst);
    },
  };
}
