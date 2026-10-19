import { route } from "@/lib/api";

/** Unauthenticated liveness probe (load balancers/uptime checks). Reveals nothing about configuration. */
export const GET = route(async () => ({ status: "ok", time: new Date().toISOString() }), { auth: false });
