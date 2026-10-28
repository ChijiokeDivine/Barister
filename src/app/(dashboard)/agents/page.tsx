import { AgentsBoard } from "@/components/dashboard/agents/AgentsBoard";
import { getAgentsData } from "@/lib/server/queries";

export const instant = false;

/** Agent execution monitor. */
export default async function AgentsPage() {
  const data = await getAgentsData();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <AgentsBoard initial={data.feed} matters={data.matters} />
    </div>
  );
}
