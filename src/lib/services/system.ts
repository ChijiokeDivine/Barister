import { relayerInfo } from "../chain";
import { env } from "../env";
import { getStore } from "../store";

/** Integration health for the dashboard/settings. Booleans and model names only — never secrets. */
export async function getSystemStatus() {
  const e = env();
  let storage: { driver: string; ok: boolean; error?: string };
  try {
    storage = { driver: getStore().driver, ok: true };
  } catch (err) {
    storage = { driver: e.STORAGE_DRIVER ?? "unset", ok: false, error: (err as Error).message };
  }
  return {
    auth: Boolean(e.APP_API_KEY),
    encryption: Boolean(e.VAULT_ENCRYPTION_KEY),
    storage,
    llm: {
      gemini: { configured: Boolean(e.GEMINI_API_KEY), model: e.GEMINI_MODEL, fallback: e.GEMINI_FALLBACK_MODEL },
      groq: { configured: Boolean(e.GROQ_API_KEY), model: e.GROQ_MODEL },
    },
    chain: await relayerInfo().catch(() => ({ configured: Boolean(e.ANCHOR_PRIVATE_KEY), error: "rpc_unavailable" })),
    limits: { maxUploadMb: e.MAX_UPLOAD_MB, maxLargeUploadMb: e.MAX_LARGE_UPLOAD_MB },
  };
}

export type SystemStatus = Awaited<ReturnType<typeof getSystemStatus>>;
