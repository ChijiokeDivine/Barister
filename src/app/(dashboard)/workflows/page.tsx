import Link from "next/link";
import { LuArrowRight, LuLayers, LuPlay, LuPlus, LuSparkles } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { getWorkflowsData } from "@/lib/server/queries";
import { relativeTime } from "@/lib/ui/format";
import { runLabel, runTone } from "@/lib/ui/status";

export const instant = false;

/** Workflow library: saved pipelines, templates and recent runs. */
export default async function WorkflowsPage() {
  const data = await getWorkflowsData();

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] leading-tight text-fg">Workflows</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-fg-muted">
            Multi-agent pipelines that turn redacted matter documents into chronologies, inconsistency findings and deliverables.
          </p>
        </div>
        <Link href="/workflows/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-[13px] font-medium text-white transition hover:bg-black">
          <LuPlus aria-hidden className="size-4" /> New workflow
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Workflows" value={data.workflows.length} />
        <Stat label="Templates" value={data.templates.length} />
        <Stat label="Runs" value={data.runs.length} hint={`${data.runs.filter((r) => r.status === "running" || r.status === "queued").length} active`} />
        <Stat label="Deliverables" value={data.outputs.length} />
      </div>

      <section aria-labelledby="templates-heading" className="mt-7">
        <div className="flex items-center justify-between">
          <h2 id="templates-heading" className="font-serif text-[19px] leading-none text-fg">
            Start from a template
          </h2>
          <span className="text-[12px] text-fg-subtle">Editable on the canvas</span>
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          {data.templates.map((t) => (
            <Link
              key={t.id}
              href={`/workflows/new?template=${t.id}`}
              className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 outline-none transition-colors hover:border-accent/30 hover:bg-surface-strong focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <div>
                <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-md bg-canvas text-[14px] text-accent">
                  <LuSparkles />
                </span>
                <h3 className="mt-2.5 text-[13.5px] font-medium text-fg">{t.name}</h3>
                <p className="mt-1 text-[12px] leading-5 text-fg-muted">{t.description}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
                {t.graph.nodes.length} nodes · {t.graph.edges.length} connections
                <LuArrowRight aria-hidden className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Your workflows" description="Saved graphs; open one to edit or run it." action={<Link href="/workflows/new" className="text-[12.5px] font-medium text-accent hover:underline">Blank canvas</Link>} bodyClassName="p-2">
          {data.workflows.length ? (
            <RowList>
              {data.workflows.map((w) => (
                <RowItem key={w.id}>
                  <DataRow
                    href={`/workflows/${w.id}`}
                    icon={<LuLayers />}
                    title={w.name}
                    meta={`${w.nodeCount} nodes · updated ${relativeTime(w.updatedAt)}`}
                    right={<span className="text-[12px] font-medium text-accent">Open</span>}
                  />
                </RowItem>
              ))}
            </RowList>
          ) : (
            <EmptyState
              icon={<LuLayers />}
              title="No saved workflows"
              description="Start blank or copy a template, then wire the steps together."
              action={
                <Link href="/workflows/new" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-fg px-3 text-[12px] font-medium text-white hover:bg-black">
                  <LuPlus aria-hidden className="size-3.5" /> New workflow
                </Link>
              }
            />
          )}
        </Panel>

        <Panel title="Recent runs" description="Every run keeps its own graph snapshot." action={<Link href="/agents" className="text-[12.5px] font-medium text-accent hover:underline">Agents</Link>} bodyClassName="p-2">
          {data.runs.length ? (
            <RowList>
              {data.runs.map((r) => (
                <RowItem key={r.id}>
                  <DataRow
                    href={`/runs/${r.id}`}
                    icon={<LuPlay />}
                    title={r.workflowName}
                    meta={relativeTime(r.finishedAt ?? r.startedAt ?? r.createdAt)}
                    right={<Badge tone={runTone[r.status]}>{runLabel[r.status]}</Badge>}
                  />
                </RowItem>
              ))}
            </RowList>
          ) : (
            <p className="px-2 py-3 text-[13px] text-fg-muted">No runs yet. Open a workflow and press Run.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
