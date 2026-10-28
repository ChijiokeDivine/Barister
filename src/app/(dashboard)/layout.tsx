import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/layout/AppShell";
import { getWorkspaceNav } from "@/lib/server/queries";

// The workspace is request-time data (encrypted store); blocking renders are expected.
export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const nav = await getWorkspaceNav();
  return <AppShell nav={nav}>{children}</AppShell>;
}
