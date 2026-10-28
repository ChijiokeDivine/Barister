import { ChatView } from "@/components/dashboard/chat/ChatView";
import { getChatSetup } from "@/lib/server/queries";
import type { ModelOption } from "@/components/dashboard/types";

export const instant = false;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** New chat. `?q=` auto-sends the first turn, then the URL becomes /chat/[id]. */
export default async function ChatPage({ searchParams }: Props) {
  const [params, setup] = await Promise.all([searchParams, getChatSetup()]);
  const tier = one(params.tier);
  return (
    <ChatView
      matters={setup.matters}
      models={setup.models}
      autoQuery={one(params.q)?.trim() || undefined}
      autoMatter={one(params.matter) ?? null}
      autoTier={tier === "long" || tier === "fast" || tier === "auto" ? (tier as ModelOption["value"]) : undefined}
      autoSources={one(params.sources)?.split(",").filter(Boolean)}
    />
  );
}
