"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { Button } from "../ui/Button";

/** Removes a sealed chat transcript without touching any vault documents. */
export function DeleteConversationButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api(`/api/chat/conversations/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not delete the conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" aria-label="Delete conversation" onClick={remove} loading={busy}>
      <LuTrash2 aria-hidden className="size-3.5" />
    </Button>
  );
}
