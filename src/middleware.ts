import { NextResponse, type NextRequest } from "next/server";

/**
 * Browser session bridge.
 *
 * The API is protected by a single bearer key (APP_API_KEY) that must never reach the browser.
 * Page navigations receive an httpOnly session cookie derived from that key; API calls made by
 * the app are authenticated by the cookie and get the bearer header attached here. External
 * clients keep using `Authorization: Bearer <key>` / `x-api-key` as before.
 */
const COOKIE = "barister_session";

async function sessionToken(key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode("barister-ui-session"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const key = process.env.APP_API_KEY;
  if (!key) return NextResponse.next();

  const token = await sessionToken(key);
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (isApi) {
    if (req.headers.has("authorization") || req.headers.has("x-api-key")) return NextResponse.next();
    if (req.cookies.get(COOKIE)?.value !== token) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Missing or invalid API key" } }, { status: 401 });
    }
    const headers = new Headers(req.headers);
    headers.set("x-api-key", key);
    return NextResponse.next({ request: { headers } });
  }

  const res = NextResponse.next();
  if (req.cookies.get(COOKIE)?.value !== token) {
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|gif|ico|mp4|woff2?|ttf)$).*)"],
};
