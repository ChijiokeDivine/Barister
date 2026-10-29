import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// scrypt with interactive-login cost parameters (N=2^14, r=8, p=1). The encoded
// format carries its parameters so hashes can be upgraded without breaking logins.
const KEY_LENGTH = 64;
const N = 16_384;
const R = 8;
const P = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (!nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || n < 2 || r < 1 || p < 1) return false;
  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    // Only the parameters we issue are accepted; a hostile row cannot make us
    // burn unbounded CPU by claiming N=2^30.
    if (n !== N || r !== R || p !== P) return false;
    const actual = await scrypt(password.normalize("NFKC"), salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
