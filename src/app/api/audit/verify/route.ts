import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { verifyHash } from "@/lib/services/anchors";

export const maxDuration = 60;

/** Independent check against the chain itself (not our ledger). Frontend: hash a file client-side, then GET ?hash=… */
export const GET = route(async (req) => verifyHash(parseQuery(req, z.object({ hash: z.string().length(64) })).hash));
