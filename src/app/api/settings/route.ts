import { parseBody, route } from "@/lib/api";
import { getSettings, saveSettings, SettingsSchema } from "@/lib/services/settings";

export const GET = route(async () => getSettings());

/** Full replace. Changing redaction rules affects NEW redactions; call /api/cases/:id/reredact to apply to existing docs. */
export const PUT = route(async (req) => saveSettings(await parseBody(req, SettingsSchema)));
