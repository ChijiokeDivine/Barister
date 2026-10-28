import { route } from "@/lib/api";
import { conversations, getConversation } from "@/lib/services/chat";

type P = { id: string };

export const GET = route<P>(async (_r, { params }) => {
  const { messages, ...c } = await getConversation(params.id);
  return { ...c, messages, messageCount: messages.length };
});

/** Deleting a conversation only removes the sealed transcript; referenced documents stay in the vault. */
export const DELETE = route<P>(async (_r, { params }) => {
  await getConversation(params.id);
  await conversations.del(params.id);
  return { deleted: true };
});
