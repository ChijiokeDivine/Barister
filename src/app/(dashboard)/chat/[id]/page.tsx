import { notFound } from "next/navigation";
import { ChatView } from "@/components/dashboard/chat/ChatView";
import { getChatSetup, getConversationPage } from "@/lib/server/queries";

export const instant = false;

/** Existing thread: history + streaming follow-up turns. */
export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [page, setup] = await Promise.all([getConversationPage(id), getChatSetup()]);
  if (!page) notFound();
  const { conversation } = page;

  return (
    <ChatView
      initial={{
        id: conversation.id,
        caseId: conversation.caseId,
        title: conversation.title,
        messages: conversation.messages,
        docIds: conversation.docIds,
      }}
      matters={setup.matters}
      models={setup.models}
    />
  );
}
