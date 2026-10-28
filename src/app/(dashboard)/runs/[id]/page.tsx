import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft, LuFileText, LuLayers, LuPlay, LuShieldCheck } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { RunMonitor } from "@/components/dashboard/runs/RunMonitor";
import { getRunPage } from "@/lib/server/queries";
import { formatDate, titleCase } from "@/lib/ui/format";
import { runLabel, runTone } from "@/lib/ui/status";

export const instant = false;

/** One run: live agent log, graph snapshot, proofs and deliverables. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRunPage(id).catch(() => null);
  if (!data) notFound();
  const { run, matter, outputs, workflow } = data;

  return (
    <>
      <header className="shrink-0 border-b border-line bg-canvas px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link
              href="/agents"
              aria-label="Back to agents"
              className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[15px] text-fg-muted outline-none transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuArrowLeft aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 truncate font-serif text-[21px] leading-tight text-fg sm:text-[24px]">{run.workflowName}</h1>
                <Badge tone={runTone[run.status]}>{runLabel[run.status]}</Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted">
                {matter ? (
                  <Link href={`/cases/${matter.id}`} className="hover:text-accent">
                    {matter.number} · {matter.name}
                  </Link>
                ) : (
                  <span>No matter</span>
                )}
                <span aria-hidden>·</span>
                <span className="font-mono text-[11px]">{run.id}</span>
                <span aria-hidden>·</span>
                <span>{formatDate(run.createdAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {workflow && (
              <Link href={`/workflows/${workflow.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition hover:bg-surface">
                <LuLayers aria-hidden className="size-3.5" /> Open workflow
              </Link>
            )}
            <Link href="/audit-trail" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition hover:bg-surface">
              <LuShieldCheck aria-hidden className="size-3.5" /> Audit trail
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Nodes" value={run.graph.nodes.length} />
          <Stat label="Outputs" value={run.outputs.length} />
          <Stat label="Attempts" value={run.attempts} />
          <Stat label="Models" value={run.models.length} hint={run.models.length ? run.models.join(", ") : "No calls yet"} />
        </div>

        {run.error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] leading-5 text-red-700">
            {run.error}
          </p>
        )}
        {run.proofError && (
          <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-5 text-amber-800">
            Proof anchoring: {run.proofError}
          </p>
        )}
        {run.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
            {run.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <RunMonitor
              runId={run.id}
              initialLogs={data.logs}
              initialCursor={data.cursor}
              initialStatus={run.status}
              resumable={Boolean(run.resumable)}
            />
          </div>

          <aside className="space-y-4">
            <Panel title="Deliverables" description="Saved at the end of the run." bodyClassName="p-2">
              {outputs.length ? (
                <RowList>
                  {outputs.map((o) => (
                    <RowItem key={o.id}>
                      <DataRow href={`/outputs/${o.id}`} icon={<LuFileText />} title={o.title} meta={`${titleCase(o.kind)} · ${formatDate(o.createdAt)}`} />
                    </RowItem>
                  ))}
                </RowList>
              ) : (
                <p className="px-2 py-3 text-[13px] text-fg-muted">No deliverables yet.</p>
              )}
            </Panel>

            <Panel title="Run details">
              <dl className="space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Started</dt>
                  <dd className="text-right text-fg">{formatDate(run.startedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Finished</dt>
                  <dd className="text-right text-fg">{formatDate(run.finishedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Workflow</dt>
                  <dd className="max-w-[170px] truncate text-right text-fg">{run.workflowName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Proof</dt>
                  <dd className="text-right text-fg">{run.proofAnchorId ? "Anchored" : "Not anchored"}</dd>
                </div>
              </dl>
              {run.instructions && <p className="mt-3 rounded-md bg-surface px-2.5 py-2 text-[11.5px] leading-5 text-fg-muted">{run.instructions}</p>}
            </Panel>

            <Panel title="Graph snapshot" description="What this run executed." bodyClassName="p-2">
              <RowList>
                {run.graph.nodes.map((n) => (
                  <RowItem key={n.id}>
                    <DataRow icon={<LuPlay />} title={n.data.label ?? n.type} meta={`${n.id} · ${n.type}`} />
                  </RowItem>
                ))}
              </RowList>
            </Panel>

            {outputs.length === 0 && run.status === "succeeded" && (
              <EmptyState icon={<LuFileText />} title="No deliverables" description="The graph finished without an output node." />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
