/**
 * Ethereum Sepolia proof layer (viem).
 *
 * What goes on-chain: ONLY a 32-byte SHA-256 digest (prefixed "LF1") in the calldata of a 0-ETH self-transaction.
 * Never filenames, text or names — a hash proves "this exact content existed at this block time" without revealing it.
 *
 * Why a plain calldata tx instead of a smart contract: nothing to deploy/audit, the cheapest possible write,
 * and the proof is independently checkable by anyone on Etherscan (tx input == "0x4c4631" + hash).
 *
 * Why a server-side relayer key: attorneys shouldn't need a wallet. Because the key only ever holds testnet ETH and
 * pays gas for hash writes, a leak is low-impact — still, it must never be a mainnet key (documented in .env.example).
 */
import { concatHex, createPublicClient, createWalletClient, http, stringToHex, type Hex } from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { env, need } from "./env";
import { upstream } from "./errors";
import { isSha256Hex, toHexPrefixed } from "./hash";

export const CHAIN = sepolia;
export const EXPLORER = "https://sepolia.etherscan.io";
export const PROOF_PREFIX = stringToHex("LF1"); // 0x4c4631
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`;

export const chainConfigured = () => Boolean(env().ANCHOR_PRIVATE_KEY);

const publicClient = () => createPublicClient({ chain: CHAIN, transport: http(env().SEPOLIA_RPC_URL) });

function relayer() {
  // nonceManager: tracks nonces locally so several anchors fired in parallel don't collide on the same nonce.
  const account = privateKeyToAccount(need("ANCHOR_PRIVATE_KEY") as Hex, { nonceManager });
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(env().SEPOLIA_RPC_URL) });
  return { account, wallet };
}

export function proofCalldata(sha256: string): Hex {
  if (!isSha256Hex(sha256)) throw new Error("Not a SHA-256 hex digest");
  return concatHex([PROOF_PREFIX, toHexPrefixed(sha256.toLowerCase())]);
}

/** Wallet-agnostic payload so the frontend can instead have the attorney sign with their own wallet via viem. */
export function clientTxPayload(sha256: string) {
  return { chainId: CHAIN.id, value: "0x0", data: proofCalldata(sha256) }; // `to` = signer's own address
}

/** Broadcasts the proof and returns immediately with the tx hash (confirmation takes ~12s; don't block the request). */
export async function anchorHash(sha256: string): Promise<{ txHash: Hex; from: Hex }> {
  const { account, wallet } = relayer();
  try {
    const txHash = await wallet.sendTransaction({ account, chain: CHAIN, to: account.address, value: 0n, data: proofCalldata(sha256) });
    return { txHash, from: account.address };
  } catch (e) {
    // viem's errors are verbose and may include RPC URLs (with API keys). Keep only the short message.
    const msg = (e as { shortMessage?: string }).shortMessage ?? "transaction failed";
    throw upstream(`Sepolia anchoring failed: ${msg}`);
  }
}

export interface ChainStatus {
  status: "pending" | "confirmed" | "failed" | "not_found";
  blockNumber?: number;
  timestamp?: string; // ISO, from the BLOCK (not our clock) — the trustworthy time
  input?: Hex;
  from?: Hex;
}

/** Reads the chain for a tx. Used both to confirm our own anchors and to independently verify a hash. */
export async function getTxStatus(txHash: string): Promise<ChainStatus> {
  const client = publicClient();
  const hash = txHash as Hex;
  const tx = await client.getTransaction({ hash }).catch(() => null);
  if (!tx) return { status: "not_found" };
  if (tx.blockNumber == null) return { status: "pending", input: tx.input, from: tx.from };
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) return { status: "pending", input: tx.input, from: tx.from };
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  return {
    status: receipt.status === "success" ? "confirmed" : "failed",
    blockNumber: Number(receipt.blockNumber),
    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    input: tx.input,
    from: tx.from,
  };
}

/** True if the tx calldata is exactly our proof for this digest. */
export const inputMatches = (input: string | undefined, sha256: string) => !!input && input.toLowerCase() === proofCalldata(sha256).toLowerCase();

export async function relayerInfo() {
  if (!chainConfigured()) return { configured: false as const };
  const { account } = relayer();
  const balance = await publicClient().getBalance({ address: account.address }).catch(() => null);
  return { configured: true as const, address: account.address, balanceWei: balance?.toString() ?? null, explorer: addressUrl(account.address), chainId: CHAIN.id };
}
