/** Shared auth constants. Kept dependency-free so `proxy.ts` can import them. */
export const SESSION_COOKIE = "barister_session";

/** Sessions last 30 days; every request through the DAL checks the database. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
