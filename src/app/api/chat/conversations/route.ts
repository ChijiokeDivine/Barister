import { route } from "@/lib/api";
import { conversations } from "@/lib/services/chat";

export const GET = route(async () => (await conversations.list()).map(({ messages, ...c }) => ({ ...c, messageCount: messages.length })));
