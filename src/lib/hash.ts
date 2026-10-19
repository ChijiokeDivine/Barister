/**
 * SHA-256 helpers. Isomorphic on purpose: they use Web Crypto (browser + Node 20+), so the frontend
 * can hash a file *before* upload and the server re-hashes to verify the file wasn't altered in transit.
 */

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  // Cast: TS 5.9's lib types Uint8Array<ArrayBufferLike> which BufferSource doesn't accept directly.
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export async function hashFile(file: Blob): Promise<string> {
  return sha256Hex(await file.arrayBuffer());
}

/**
 * Deterministic JSON: keys sorted recursively so the same logical object always yields the same hash,
 * regardless of property insertion order. Required for hashing outputs/audit payloads reproducibly.
 */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, val]) => val !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, val]) => [k, sortKeys(val)]),
    );
  }
  return v;
}

export const hashJSON = (value: unknown) => sha256Hex(canonicalJSON(value));

/** "abc…" hex → "0xabc…" form that viem expects for bytes32/hex data. */
export const toHexPrefixed = (hex: string): `0x${string}` => `0x${hex.replace(/^0x/, "")}`;

export const isSha256Hex = (s: string) => /^[0-9a-f]{64}$/i.test(s);
