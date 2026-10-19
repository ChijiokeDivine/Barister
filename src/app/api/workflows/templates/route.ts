import { route } from "@/lib/api";
import { TEMPLATES } from "@/lib/services/workflows";

export const GET = route(async () => TEMPLATES);
