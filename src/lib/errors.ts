/** Typed HTTP error. Thrown anywhere in services/routes and mapped to JSON by lib/api.ts. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, "bad_request", msg, details);
export const unauthorized = () => new ApiError(401, "unauthorized", "Missing or invalid API key");
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const conflict = (msg: string) => new ApiError(409, "conflict", msg);
export const tooLarge = (msg: string) => new ApiError(413, "payload_too_large", msg);
// 503 (not 500) for missing config: it's an operator problem, and the UI can show "feature not configured".
export const notConfigured = (what: string) => new ApiError(503, "not_configured", `${what} is not configured`);
export const upstream = (msg: string, details?: unknown) => new ApiError(502, "upstream_error", msg, details);
