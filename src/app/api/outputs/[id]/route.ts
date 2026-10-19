import { route } from "@/lib/api";
import { deleteOutput, getOutput, verifyOutputIntegrity } from "@/lib/services/outputs";

type P = { id: string };
export const GET = route<P>(async (_r, { params }) => {
  const { record, content } = await getOutput(params.id);
  return { ...record, content, integrity: await verifyOutputIntegrity(params.id) };
});
export const DELETE = route<P>(async (_r, { params }) => (await deleteOutput(params.id), { deleted: true }));
