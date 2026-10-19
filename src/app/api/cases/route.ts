import { json, parseBody, route } from "@/lib/api";
import { CaseInputSchema, cases, createCase } from "@/lib/services/cases";

export const GET = route(async () => cases.list());
export const POST = route(async (req) => json(await createCase(await parseBody(req, CaseInputSchema)), 201));
