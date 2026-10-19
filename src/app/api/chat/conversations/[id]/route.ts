import { route } from "@/lib/api";
import { conversations, getConversation } from "@/lib/services/chat";

type P = { id: string };
export const GET = route<P>(async (_r, { params }) => getConversation(params.id));
export const DELETE = route<P>(async (_r, { params }) => (await getConversation(params.id), await conversations.del(params.id), { deleted: true }));
