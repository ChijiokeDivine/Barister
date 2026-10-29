import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/** Pages that make up the public marketing site and the auth flow. */
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"]);

/**
 * Optimistic route protection. This only checks that a session cookie exists —
 * it never touches the database, because Proxy runs on every request including
 * prefetches. The authoritative check happens in `getCurrentUser()` (DAL) and
 * `requireAuth()` (API routes).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSessionCookie && !PUBLIC_PATHS.has(pathname)) {
    const url = new URL("/sign-in", req.url);
    // Send the user back where they were headed after a successful sign-in.
    if (pathname !== "/dashboard") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
