import { route } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";

/** Returns the signed-in user, or `null`. Used by clients that need a quick auth check. */
export const GET = route(async () => ({ user: await getSessionUser() }), { auth: false });
