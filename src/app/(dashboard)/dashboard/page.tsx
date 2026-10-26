import { LauncherComposer } from "@/components/dashboard/chat/ChatComposer";
import { QuickSources } from "@/components/dashboard/chat/QuickSources";
import { currentUser, matters, models, quickSources } from "@/components/dashboard/data/mock";
import { TimeGreeting } from "@/components/dashboard/layout/Greeting";

/** Home: greeting, launcher composer and source chips. */
export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 pb-24">
      <TimeGreeting name={currentUser.firstName} />
      <div className="mt-9 w-full max-w-[680px]">
        <LauncherComposer matters={matters} models={models} />
        <QuickSources sources={quickSources} className="mt-3" />
      </div>
    </div>
  );
}
