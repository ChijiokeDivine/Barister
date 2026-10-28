"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { Button } from "../ui/Button";

export function DeleteOutputButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm("Delete this deliverable? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/outputs/${id}`, { method: "DELETE" });
      router.push("/outputs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the deliverable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button variant="danger" size="sm" className="w-full" onClick={remove} loading={busy}>
        <LuTrash2 aria-hidden className="size-3.5" /> Delete
      </Button>
      {error && <p role="alert" className="text-[11.5px] text-red-600">{error}</p>}
    </div>
  );
}
