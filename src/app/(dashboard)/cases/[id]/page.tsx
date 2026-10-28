import Link from "next/link";
import { notFound } from "next/navigation";
import { LuBot, LuFileText, LuFolder, LuLayers, LuPlay, LuPlus, LuShieldCheck } from "react-icons/lu";
import { ActivityCard } from "@/components/dashboard/cards/ActivityCard";
import { ResourceSection } from "@/components/dashboard/cards/ResourceSection";
import { CaseHeader } from "@/components/dashboard/cases/CaseHeader";
import { MatterComposer } from "@/components/dashboard/chat/ChatComposer";
import { HeaderLink } from "@/components/dashboard/layout/PageHeader";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import type { ResourceItem } from "@/components/dashboard/types";
import { getCaseWorkspace } from "@/lib/server/queries";
import { formatDate, relativeTime, titleCase } from "@/lib/ui/format";
import { anchorTone, runLabel, runTone } from "@/lib/ui/status";

export const instant = false;

const tabs = [
  { id: "home", label: "Home" },
  { id: "tasks", label: "Tasks" },
  { id: "agents", label: "Agents" },
  { id: "vault", label: "Vault" },
  { id: "tools", label: "Tools" },
  { id: "activity", label: "Activity" },
];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Space home: header + tabs, composer, vaults, library and activity rail. */
export default async function CasePage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getCaseWorkspace(id);
  if (!data) notFound();

  const requested = one(sp.tab) ?? "home";
  const tab = tabs.some((t) => t.id === requested) ? requested : "home";

  const vaultItems: ResourceItem[] = data.documents.slice(0, 6).map((d) => ({
    id: d.id,
    title: d.name,
    files: d.pages ?? 0,
    comments: Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0),
    href: `/vault/${d.id}`,
    units: { files: "pages", comments: "redactions" },
  }));

  const libraryItems: ResourceItem[] = data.workflows.slice(0, 6).map((w) => ({
    id: w.id,
    title: w.name,
    files: w.nodeCount,
    comments: data.runs.filter((r) => r.workflowId === w.id).length,
    href: `/workflows/${w.id}`,
    units: { files: "nodes", comments: "runs" },
  }));

  const header = (
    <CaseHeader
      caseId={data.record.id}
      title={data.title}
      tabs={tabs}
      activeTab={tab}
      action={<HeaderLink href={`/chat?matter=${data.record.id}`}>New chat</HeaderLink>}
    />
  );

  if (tab === "home") {
    return (
      <>
        {header}
        <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10 lg:px-10 lg:py-7">
          <div className="min-w-0 space-y-8 lg:space-y-10">
            <MatterComposer
              matter={data.matter}
              spaceName={data.title}
              size="compact"
              resources={{ count: data.documents.length + data.outputs.length, vaults: data.documents.length, queries: data.conversations.length }}
            />
            {vaultItems.length ? (
              <ResourceSection title="Vaults" items={vaultItems} viewAllHref={`/vault?caseId=${data.record.id}`} />
            ) : (
              <Panel title="Vault">
                <EmptyState
                  icon={<LuFolder />}
                  title="No documents yet"
                  description="Upload contracts, transcripts or discovery to ground chat and workflows in this matter."
                  action={<HeaderLink href={`/vault?caseId=${data.record.id}`}>Upload documents</HeaderLink>}
                />
              </Panel>
            )}
            {libraryItems.length ? (
              <ResourceSection title="Library" items={libraryItems} viewAllHref="/workflows" />
            ) : (
              <Panel title="Library">
                <EmptyState
                  icon={<LuLayers />}
                  title="No workflows yet"
                  description="Start from a template or build a pipeline on the canvas."
                  action={<HeaderLink href="/workflows">Browse workflows</HeaderLink>}
                />
              </Panel>
            )}
          </div>
          <aside className="lg:pt-1">
            <ActivityCard items={data.activity} viewAllHref={`/cases/${data.record.id}?tab=activity`} />
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Documents" value={data.documents.length} hint={`${data.vaultCount} redaction categories`} />
          <Stat label="Runs" value={data.runs.length} hint={`${data.activeRunCount} active`} />
          <Stat label="Deliverables" value={data.outputs.length} hint="Saved outputs" />
          <Stat label="Anchors" value={data.anchors.length} hint="On-chain proofs" />
        </div>

        <div className="mt-5 space-y-5">
          {tab === "tasks" && (
            <>
              <Panel title="Runs" description="Queued, active and finished workflows for this matter." action={<HeaderLink href="/workflows">Run a workflow</HeaderLink>}>
                {data.runs.length ? (
                  <RowList>
                    {data.runs.map((r) => (
                      <RowItem key={r.id}>
                        <DataRow
                          href={`/runs/${r.id}`}
                          icon={<LuPlay />}
                          title={r.workflowName}
                          meta={`${r.outputs.length} output${r.outputs.length === 1 ? "" : "s"} · ${relativeTime(r.finishedAt ?? r.startedAt ?? r.createdAt)}`}
                          right={<Badge tone={runTone[r.status]}>{runLabel[r.status]}</Badge>}
                        />
                      </RowItem>
                    ))}
                  </RowList>
                ) : (
                  <EmptyState icon={<LuPlay />} title="No runs yet" description="Run a workflow to produce a deliverable for this matter." action={<HeaderLink href="/workflows">Open workflows</HeaderLink>} />
                )}
              </Panel>
              <Panel title="Deliverables">
                {data.outputs.length ? (
                  <RowList>
                    {data.outputs.map((o) => (
                      <RowItem key={o.id}>
                        <DataRow href={`/outputs/${o.id}`} icon={<LuFileText />} title={o.title} meta={`${titleCase(o.kind)} · ${formatDate(o.createdAt)}`} />
                      </RowItem>
                    ))}
                  </RowList>
                ) : (
                  <p className="px-2 py-3 text-[13px] text-fg-muted">No deliverables yet.</p>
                )}
              </Panel>
            </>
          )}

          {tab === "agents" && (
            <Panel title="Agent activity" description="Work executed for this matter." action={<HeaderLink href="/agents">All agents</HeaderLink>}>
              {data.runs.length ? (
                <RowList>
                  {data.runs.map((r) => (
                    <RowItem key={r.id}>
                      <DataRow
                        href={`/runs/${r.id}`}
                        icon={<LuBot />}
                        title={r.workflowName}
                        meta={`${r.models.length ? r.models.join(", ") : "No model calls yet"} · attempt ${r.attempts}`}
                        right={<Badge tone={runTone[r.status]}>{runLabel[r.status]}</Badge>}
                      />
                    </RowItem>
                  ))}
                </RowList>
              ) : (
                <EmptyState icon={<LuBot />} title="No agent activity" description="Agents appear here once a workflow runs against this matter." />
              )}
            </Panel>
          )}

          {tab === "vault" && (
            <Panel
              title="Vault"
              description={`${data.documents.length} document${data.documents.length === 1 ? "" : "s"} · ${data.redactions} redactions`}
              action={<HeaderLink href={`/vault?caseId=${data.record.id}`}>Upload</HeaderLink>}
            >
              {data.documents.length ? (
                <RowList>
                  {data.documents.map((d) => (
                    <RowItem key={d.id}>
                      <DataRow
                        href={`/vault/${d.id}`}
                        icon={<LuFileText />}
                        title={d.name}
                        meta={`${d.pages ?? "—"} pages · ${Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0)} redactions · ${relativeTime(d.createdAt)}`}
                        right={d.anchorId ? <Badge tone="success">Anchored</Badge> : <Badge tone="neutral">{d.kind.toUpperCase()}</Badge>}
                      />
                    </RowItem>
                  ))}
                </RowList>
              ) : (
                <EmptyState icon={<LuFolder />} title="Vault is empty" description="Upload documents to redact and ground this matter." action={<HeaderLink href={`/vault?caseId=${data.record.id}`}>Upload documents</HeaderLink>} />
              )}
            </Panel>
          )}

          {tab === "tools" && (
            <Panel title="Workflows" description="Pipelines available to this workspace." action={<HeaderLink href="/workflows/new">New workflow</HeaderLink>}>
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
                <EmptyState icon={<LuLayers />} title="No workflows" description="Build one on the canvas or start from a template." action={<HeaderLink href="/workflows">Browse templates</HeaderLink>} />
              )}
            </Panel>
          )}

          {tab === "activity" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Recent activity">
                <ActivityCard items={data.activity} viewAllHref={`/cases/${data.record.id}?tab=activity`} />
              </Panel>
              <Panel title="On-chain anchors" description="Immutable proofs for documents and runs in this matter.">
                {data.anchors.length ? (
                  <RowList>
                    {data.anchors.map((a) => (
                      <RowItem key={a.id}>
                        <DataRow
                          icon={<LuShieldCheck />}
                          title={a.kind === "document" ? "Document proof" : a.kind === "run_proof" ? "Run proof" : "Custom proof"}
                          meta={`${a.hash.slice(0, 12)}… · ${a.blockNumber ? `block ${a.blockNumber}` : relativeTime(a.createdAt)}`}
                          right={
                            <span className="flex items-center gap-2">
                              <Badge tone={anchorTone[a.status] ?? "neutral"}>{titleCase(a.status)}</Badge>
                              {a.explorerUrl && (
                                <Link href={a.explorerUrl} target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">
                                  Explorer
                                </Link>
                              )}
                            </span>
                          }
                        />
                      </RowItem>
                    ))}
                  </RowList>
                ) : (
                  <EmptyState icon={<LuShieldCheck />} title="Nothing anchored" description="Anchor a document or enable anchoring on a deliverable to create a proof." />
                )}
              </Panel>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/chat?matter=${data.record.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-fg px-3 text-[12px] font-medium text-white transition hover:bg-black">
            <LuPlus aria-hidden className="size-3.5" /> New chat
          </Link>
          <Link href={`/vault?caseId=${data.record.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-[12px] font-medium text-fg transition hover:bg-surface">
            <LuFolder aria-hidden className="size-3.5" /> Vault
          </Link>
        </div>
      </div>
    </>
  );
}
