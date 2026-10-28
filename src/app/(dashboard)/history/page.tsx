import { LuClock, LuMessageSquare, LuPlay } from "react-icons/lu";
import { DeleteConversationButton } from "@/components/dashboard/history/DeleteConversationButton";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { UrlTabs } from "@/components/dashboard/ui/UrlTabs";
import { getHistoryData } from "@/lib/server/queries";
import { relativeTime } from "@/lib/ui/format";
import { runLabel, runTone } from "@/lib/ui/status";

export const instant = false;

const tabs = [
  { id: "conversations", label: "Conversations" },
  { id: "runs", label: "Runs" },
];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HistoryPage({ searchParams }: Props) {
  const [sp, data] = await Promise.all([searchParams, getHistoryData()]);
  const requested = one(sp.tab) ?? "conversations";
  const tab = tabs.some((t) => t.id === requested) ? requested : "conversations";
  const matterName = (id: string | null) => data.matters.find((m) => m.id === id)?.name;

  const succeeded = data.runs.filter((r) => r.status === "succeeded").length;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] leading-tight text-fg">History</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-fg-muted">
            Every chat and workflow run, newest first. Transcripts are sealed at rest; runs keep their inputs, outputs and proofs.
          </p>
        </div>
        <UrlTabs items={tabs} value={tab} label="History sections" className="pt-1" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Conversations" value={data.conversations.length} />
        <Stat label="Runs" value={data.runs.length} />
        <Stat label="Succeeded" value={succeeded} />
        <Stat label="Active" value={data.runs.filter((r) => r.status === "running" || r.status === "queued").length} />
      </div>

      <div className="mt-5">
        {tab === "conversations" ? (
          <Panel title="Conversations" description="Open a transcript to continue where you left off." bodyClassName="p-2">
            {data.conversations.length ? (
              <RowList>
                {data.conversations.map((c) => (
                  <RowItem key={c.id}>
                    <DataRow
                      href={`/chat/${c.id}`}
                      icon={<LuMessageSquare />}
                      title={c.title}
                      meta={`${matterName(c.caseId) ?? "General"} · ${c.messageCount} message${c.messageCount === 1 ? "" : "s"} · ${relativeTime(c.updatedAt)}`}
                      right={<DeleteConversationButton id={c.id} />}
                    />
                  </RowItem>
                ))}
              </RowList>
            ) : (
              <EmptyState icon={<LuMessageSquare />} title="No conversations yet" description="Start a chat and it will appear here." />
            )}
          </Panel>
        ) : (
          <Panel title="Runs" description="Workflow executions with their outputs and proofs." bodyClassName="p-2">
            {data.runs.length ? (
              <RowList>
                {data.runs.map((r) => (
                  <RowItem key={r.id}>
                    <DataRow
                      href={`/runs/${r.id}`}
                      icon={<LuPlay />}
                      title={r.workflowName}
                      meta={`${matterName(r.caseId) ?? "General"} · ${r.outputs.length} output${r.outputs.length === 1 ? "" : "s"} · ${relativeTime(r.finishedAt ?? r.startedAt ?? r.createdAt)}`}
                      right={<Badge tone={runTone[r.status]}>{runLabel[r.status]}</Badge>}
                    />
                  </RowItem>
                ))}
              </RowList>
            ) : (
              <EmptyState icon={<LuClock />} title="No runs yet" description="Run a workflow and its log will appear here." />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
