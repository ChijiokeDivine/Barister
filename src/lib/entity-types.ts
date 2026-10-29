/** PII categories shared by the redaction engine and the settings UI (kept dependency-free for client bundles). */
export const ENTITY_TYPES = ["NAME", "EMAIL", "PHONE", "SSN", "CARD", "AMOUNT", "DATE", "ADDRESS", "IP", "URL", "CUSTOM"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Human labels for every category, used by the settings page and the matter redaction editor. */
export const ENTITY_LABELS: Record<EntityType, string> = {
  NAME: "Names",
  EMAIL: "Emails",
  PHONE: "Phone numbers",
  SSN: "Social security numbers",
  CARD: "Card numbers",
  AMOUNT: "Amounts",
  DATE: "Dates",
  ADDRESS: "Addresses",
  IP: "IP addresses",
  URL: "URLs",
  CUSTOM: "Custom patterns",
};
