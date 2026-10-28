import { route } from "@/lib/api";
import { getSystemStatus } from "@/lib/services/system";

/** Dashboard "system status": which integrations are live. Booleans/model names only — never secrets. */
export const GET = route(async () => getSystemStatus());
