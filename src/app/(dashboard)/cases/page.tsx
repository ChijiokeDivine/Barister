import { currentUser, matters } from "@/components/dashboard/data/mock";
import { TimeGreeting } from "@/components/dashboard/layout/Greeting";
import { MatterSearch } from "@/components/dashboard/search/MatterSearch";

/** Matter picker: greeting + searchable matter list. */
export default function CasesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 pb-24">
      <TimeGreeting name={currentUser.firstName} size="lg" />
      <MatterSearch matters={matters} className="mt-9 w-full max-w-[440px]" />
    </div>
  );
}
