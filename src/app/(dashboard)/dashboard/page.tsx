import Link from "next/link";
import { HomeLauncher } from "@/components/dashboard/chat/HomeLauncher";
import { TimeGreeting } from "@/components/dashboard/layout/Greeting";
import { getDashboardData } from "@/lib/server/queries";
import { currentUser } from "@/lib/ui/user";

// Workspace data is request-time (encrypted store).
export const instant = false;

/** Home: greeting, launcher composer and source chips. */
export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6 lg:pb-24">
      <TimeGreeting name={currentUser.firstName} />
      <div className="mt-7 w-full max-w-[680px] sm:mt-9">
        <HomeLauncher matters={data.matters} models={data.models} />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-fg-subtle">
          <Link href="/cases" className="transition-colors hover:text-fg">
            {data.counts.matters} matter{data.counts.matters === 1 ? "" : "s"}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/vault" className="transition-colors hover:text-fg">
            {data.counts.documents} document{data.counts.documents === 1 ? "" : "s"}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/workflows" className="transition-colors hover:text-fg">
            {data.counts.workflows} workflow{data.counts.workflows === 1 ? "" : "s"}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/outputs" className="transition-colors hover:text-fg">
            {data.counts.outputs} deliverable{data.counts.outputs === 1 ? "" : "s"}
          </Link>
          {data.counts.activeRuns > 0 && (
            <>
              <span aria-hidden>·</span>
              <Link href="/agents" className="inline-flex items-center gap-1.5 text-accent transition-colors hover:text-fg">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                {data.counts.activeRuns} running
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
