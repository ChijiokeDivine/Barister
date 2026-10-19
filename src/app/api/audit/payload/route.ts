import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { clientTxPayload } from "@/lib/chain";

/**
 * For attorneys who want to sign with their OWN wallet (viem walletClient.sendTransaction({ to: <own address>, ...payload })),
 * instead of the server relayer. Returns the calldata for a given digest.
 */
export const GET = route(async (req) => clientTxPayload(parseQuery(req, z.object({ hash: z.string().regex(/^[0-9a-fA-F]{64}$/) })).hash));
