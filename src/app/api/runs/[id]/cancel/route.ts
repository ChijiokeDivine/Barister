import { route } from "@/lib/api";
import { requestCancel } from "@/lib/services/runs";

/** Cooperative: the running function notices within ~2s (checked on each log write) and aborts in-flight model calls. */
export const POST = route<{ id: string }>(async (_r, { params }) => (await requestCancel(params.id), { cancelling: true }));
