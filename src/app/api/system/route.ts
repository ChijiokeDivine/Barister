import { route } from "@/lib/api";
import { relayerInfo } from "@/lib/chain";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";

/** Dashboard "system status": which integrations are live. Booleans/model names only — never secrets. */
export const GET = route(async () => {
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
});
