/**
 * Storage contract. Two small interfaces so the app never touches a driver directly:
 *  - KV    : JSON records, field-level hashes, append-only lists (metadata, vault maps, run logs)
 *  - Blobs : opaque bytes (always ciphertext — callers encrypt first)
 */
export interface KV {
  get<T>(collection: string, id: string): Promise<T | null>;
  put(collection: string, id: string, value: unknown): Promise<void>;
  del(collection: string, id: string): Promise<void>;
  /** Fine for the hundreds-of-records scale this app targets; swap for SQL if it outgrows that. */
  list<T>(collection: string): Promise<T[]>;

  /** Field-level hash writes are atomic per field in Redis, so concurrent uploads can't clobber each other's vault entries. */
  hset(key: string, fields: Record<string, string>): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  delKey(key: string): Promise<void>;

  rpush(key: string, values: string[]): Promise<void>;
  lrange(key: string, start: number, end?: number): Promise<string[]>;
}

export interface Blobs {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  del(key: string): Promise<void>;
}

export interface Store {
  kv: KV;
  blobs: Blobs;
  driver: "file" | "cloud";
}
