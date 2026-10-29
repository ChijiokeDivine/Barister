import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/layout/AppShell";
import { getCurrentShellUser } from "@/lib/auth/dal";
import { getWorkspaceNav } from "@/lib/server/queries";

// The workspace is request-time data (encrypted store); blocking renders are expected.
export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Secure check: the proxy is only an optimistic cookie check, this hits the database.
  const [nav, user] = await Promise.all([getWorkspaceNav(), getCurrentShellUser()]);
  return (
    <AppShell nav={nav} user={user}>
      {children}
    </AppShell>
  );
}
