import { notFound } from "next/navigation";
import { MatterComposer } from "@/components/dashboard/chat/ChatComposer";
import { ActivityCard } from "@/components/dashboard/cards/ActivityCard";
import { ResourceSection } from "@/components/dashboard/cards/ResourceSection";
import { activity, library, matters, vaults } from "@/components/dashboard/data/mock";
import { HeaderButton, PageHeader } from "@/components/dashboard/layout/PageHeader";

const tabs = [
  { id: "home", label: "Home" },
  { id: "tasks", label: "Tasks" },
  { id: "agents", label: "Agents" },
  { id: "vault", label: "Vault" },
  { id: "tools", label: "Tools" },
  { id: "activity", label: "Activity" },
];

/** Space home: header + tabs, composer, vaults, library and activity rail. */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = matters.find((m) => m.id === id);
  if (!matter) notFound();

  return (
    <>
      <PageHeader title="Project Titan | Acme Co" tabs={tabs} action={<HeaderButton>Add members</HeaderButton>} />
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-10 px-10 py-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-10">
          <MatterComposer matter={matter} spaceName="Project Titan — Acme Co" size="compact" />
          <ResourceSection title="Vaults" items={vaults} viewAllHref="/vault" />
          <ResourceSection title="Library" items={library} viewAllHref="/workflows" />
        </div>
        <aside className="lg:pt-1">
          <ActivityCard items={activity} />
        </aside>
      </div>
    </>
  );
}
