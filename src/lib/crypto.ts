/**
 * Server-only encryption at rest (AES-256-GCM). Everything sensitive — document bodies, redaction maps,
 * chat messages, outputs — is sealed before it touches Redis/Blob, so a storage leak exposes only ciphertext.
 *
 * Wire format: [1 byte version][12 byte IV][16 byte GCM tag][ciphertext]. Version byte allows future key rotation.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { need } from "./env";
import { ApiError, notConfigured } from "./errors";

const VERSION = 1;

function masterKey(): Buffer {
  const raw = need("VAULT_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw notConfigured("VAULT_ENCRYPTION_KEY (must be 32 bytes, base64-encoded)");
  return key;
}

// Domain-separated sub-keys (HKDF) so the same master key is never used directly for two purposes.
const subKeyCache = new Map<string, Buffer>();
function subKey(purpose: string): Buffer {
  const k = masterKey();
  const cacheId = `${k.subarray(0, 4).toString("hex")}:${purpose}`;
  let sk = subKeyCache.get(cacheId);
  if (!sk) {
    sk = Buffer.from(hkdfSync("sha256", k, Buffer.alloc(0), `legal-flow:${purpose}`, 32));
    subKeyCache.set(cacheId, sk);
  }
  return sk;
}

export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12); // random per message: GCM must never reuse an IV under one key
  const cipher = createCipheriv("aes-256-gcm", subKey("storage"), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function decrypt(sealed: Buffer): Buffer {
  if (sealed.length < 29 || sealed[0] !== VERSION) throw new ApiError(500, "corrupt_data", "Unrecognised ciphertext");
  try {
    const decipher = createDecipheriv("aes-256-gcm", subKey("storage"), sealed.subarray(1, 13));
    decipher.setAuthTag(sealed.subarray(13, 29));
    return Buffer.concat([decipher.update(sealed.subarray(29)), decipher.final()]);
  } catch {
    // Auth-tag failure = wrong key or tampered data. Don't leak crypto internals.
    throw new ApiError(500, "decrypt_failed", "Stored data could not be decrypted (wrong key or tampering)");
  }
}

// String/JSON variants (base64) for values that live in Redis hashes.
export const sealText = (s: string) => encrypt(Buffer.from(s, "utf8")).toString("base64");
export const openText = (s: string) => decrypt(Buffer.from(s, "base64")).toString("utf8");
export const sealJSON = (v: unknown) => sealText(JSON.stringify(v));
export const openJSON = <T>(s: string): T => JSON.parse(openText(s)) as T;

/**
 * Keyed, deterministic short code. Used for redaction tokens so two concurrent uploads that meet the same
 * name independently derive the SAME token — no counter, no race, no coordination needed.
 */
export function keyedCode(namespace: string, value: string, length: number): string {
  const digest = createHmac("sha256", subKey("redaction")).update(`${namespace}\u0000${value}`).digest();
  // base32-ish alphabet without look-alike chars → easy to read in the "redacted view".
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[digest[i]! % alphabet.length];
  return out;
}

/** Deterministic integer in [min, max] derived from a namespace (used for the per-matter date offset). */
export function keyedInt(namespace: string, min: number, max: number): number {
  const digest = createHmac("sha256", subKey("redaction")).update(`int\u0000${namespace}`).digest();
  return min + (digest.readUInt32BE(0) % (max - min + 1));
}
