import { NewMatterButton } from "@/components/dashboard/cases/NewMatterButton";
import { TimeGreeting } from "@/components/dashboard/layout/Greeting";
import { MatterSearch } from "@/components/dashboard/search/MatterSearch";
import { getDashboardData } from "@/lib/server/queries";
import { getCurrentShellUser } from "@/lib/auth/dal";

export const instant = false;

/** Matter picker: greeting + searchable matter list. */
export default async function CasesPage() {
  const [data, user] = await Promise.all([getDashboardData(), getCurrentShellUser()]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6 lg:pb-24">
      <TimeGreeting name={user.firstName} size="lg" />
      <div className="mt-7 flex w-full max-w-[440px] flex-col items-center sm:mt-9">
        <MatterSearch matters={data.matters} className="w-full" />
        {data.matters.length === 0 && (
          <p className="mt-3 text-center text-[12.5px] text-fg-muted">No matters yet. Create one to start a vault and run workflows.</p>
        )}
        <NewMatterButton />
        <p className="mt-4 text-[11.5px] text-fg-subtle">
          {data.counts.documents} document{data.counts.documents === 1 ? "" : "s"} · {data.counts.workflows} workflow{data.counts.workflows === 1 ? "" : "s"} · {data.counts.outputs} deliverable{data.counts.outputs === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
