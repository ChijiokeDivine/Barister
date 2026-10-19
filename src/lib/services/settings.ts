import { z } from "zod";
import { getSealed, putSealed } from "../store";
import { RedactionSettingsSchema } from "../redact";
import { PlaybookRuleSchema } from "../agents/playbook";

export const SettingsSchema = z.object({
  redaction: RedactionSettingsSchema,
  /** Firm negotiation playbook: fed (redacted) into the contract-review agent. */
  playbook: z.array(PlaybookRuleSchema).max(200).default([]),
});
export type Settings = z.infer<typeof SettingsSchema>;

// One firm-wide settings document. Sealed: the playbook is the firm's proprietary negotiating positions.
const KEY = "default";

export async function getSettings(): Promise<Settings> {
  return (await getSealed<Settings>("settings", KEY)) ?? SettingsSchema.parse({ redaction: {}, playbook: [] });
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const s = SettingsSchema.parse(input);
  await putSealed("settings", KEY, s);
  return s;
}
