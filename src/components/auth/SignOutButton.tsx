"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuLogOut } from "react-icons/lu";
import { api } from "@/lib/client/api";
import { Button } from "@/components/dashboard/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await api("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={signOut} loading={pending} className="gap-1.5">
      <LuLogOut aria-hidden className="size-3.5" />
      Sign out
    </Button>
  );
}
