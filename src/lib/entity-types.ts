/** PII categories shared by the redaction engine and the settings UI (kept dependency-free for client bundles). */
export const ENTITY_TYPES = ["NAME", "EMAIL", "PHONE", "SSN", "CARD", "AMOUNT", "DATE", "ADDRESS", "IP", "URL", "CUSTOM"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
