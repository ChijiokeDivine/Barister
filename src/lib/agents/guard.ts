import type { Redactor } from "../redact";
import { ApiError } from "../errors";

/**
 * Last line of defence before ANY string leaves for a cloud LLM. Agents already send redacted text, so this should
 * be a no-op — it exists for the bug nobody anticipated (a new node forgetting to redact a field).
 * Scrub first (cheap, usually fixes it); if raw vault values still remain, refuse the call rather than leak.
 */
export function makeOutboundGuard(redactor: Redactor, onScrub?: (where: string) => void) {
  return (text: string, where: string): string => {
    if (!redactor.containsRaw(text)) return text;
    const scrubbed = redactor.scrubKnown(text);
    onScrub?.(where);
    if (redactor.containsRaw(scrubbed)) {
      throw new ApiError(500, "privacy_guard", `Blocked outbound LLM call: unredacted data detected in ${where}`);
    }
    return scrubbed;
  };
}
