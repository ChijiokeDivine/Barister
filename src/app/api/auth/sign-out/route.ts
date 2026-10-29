import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

/** Clears the server-side session and the browser cookie. Safe to call when already signed out. */
export const POST = route(
  async () => {
    await destroySession();
    return { ok: true };
  },
  { auth: false },
);
