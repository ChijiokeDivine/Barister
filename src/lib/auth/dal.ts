import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { ShellUser } from "./types";
import { getSessionUser } from "./session";
import { toShellUser } from "./types";

/**
 * Data-access-layer guard for pages and server components. `cache` dedupes the
 * lookup across one render pass, so the layout and page share a single query.
 * Any invalid/expired session is sent to sign in with a return path.
 */
export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
});

export async function getCurrentShellUser(): Promise<ShellUser> {
  return toShellUser(await getCurrentUser());
}
