"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuBot, LuCircleAlert, LuPlay, LuRefreshCw } from "react-icons/lu";
import { api } from "@/lib/client/api";
import type { AgentFeed } from "@/lib/ui/types";
import type { Matter } from "../types";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "../ui/Panel";
import { relativeTime } from "@/lib/ui/format";
import { runLabel, runTone } from "@/lib/ui/status";

interface AgentsBoardProps {
  initial: AgentFeed;
  matters: Matter[];
}

/** Live agent monitor: polls the same feed the API exposes. */
export function AgentsBoard({ initial, matters }: AgentsBoardProps) {
  const [feed, setFeed] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await api<AgentFeed>("/api/agents");
      setFeed(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh the agent feed.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  const matterOf = (caseId: string | null) => (caseId ? matters.find((m) => m.id === caseId) ?? null : null);
  const stalled = feed.active.filter((r) => r.stalled).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] leading-tight text-fg">Agents</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-fg-muted">Live execution monitor for workflows running across the workspace.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition hover:bg-surface disabled:opacity-50"
        >
          <LuRefreshCw aria-hidden className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Active" value={feed.active.length} hint="Queued or running" />
        <Stat label="Stalled" value={stalled} hint="Heartbeat lost" />
        <Stat label="Finished" value={feed.recentFinished.length} hint="Latest runs" />
        <Stat label="Workspace" value={matters.length} hint="Matters" />
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

      <Panel title="Active runs" description="Each card shows the most recent notable log lines." bodyClassName="p-2">
        {feed.active.length ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {feed.active.map((r) => {
              const matter = matterOf(r.caseId);
              return (
                <article key={r.id} className="rounded-lg border border-line bg-canvas p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/runs/${r.id}`} className="block truncate text-[13px] font-medium text-fg hover:text-accent">
                        {r.workflowName}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-fg-muted">
                        {matter ? `${matter.number} · ${matter.name}` : "No matter"} · {r.nodeCount} nodes
                      </p>
                    </div>
                    <Badge tone={r.stalled ? "warn" : runTone[r.status]}>{r.stalled ? "Stalled" : runLabel[r.status]}</Badge>
                  </div>
                  <ul className="mt-2.5 space-y-1.5 border-t border-line pt-2">
                    {r.recent.length ? (
                      r.recent.map((line, i) => (
                        <li key={`${line.ts}-${i}`} className="flex gap-1.5 text-[11.5px] leading-5">
                          <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-subtle" />
                          <span className="min-w-0">
                            <span className="font-medium text-fg-muted">{line.agent}: </span>
                            <span className="text-fg-muted">{line.message}</span>
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[11.5px] text-fg-subtle">Waiting for the first log line…</li>
                    )}
                  </ul>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                    <span className="text-[10.5px] text-fg-subtle">{relativeTime(r.startedAt ?? r.createdAt)}</span>
                    <Link href={`/runs/${r.id}`} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline">
                      <LuPlay aria-hidden className="size-3" /> Open run
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<LuBot />} title="No active runs" description="Start a workflow and its agent log will appear here." action={<Link href="/workflows" className="inline-flex h-8 items-center rounded-md bg-fg px-3 text-[12px] font-medium text-white hover:bg-black">Open workflows</Link>} />
        )}
      </Panel>

      <Panel title="Recently finished" bodyClassName="p-2">
        {feed.recentFinished.length ? (
          <RowList>
            {feed.recentFinished.map((r) => {
              const matter = matterOf(r.caseId);
              return (
                <RowItem key={r.id}>
                  <DataRow
                    href={`/runs/${r.id}`}
                    icon={<LuPlay />}
                    title={r.workflowName}
                    meta={`${matter ? `${matter.number} · ` : ""}${r.outputs.length} output${r.outputs.length === 1 ? "" : "s"} · ${relativeTime(r.finishedAt ?? r.createdAt)}`}
                    right={<Badge tone={runTone[r.status]}>{runLabel[r.status]}</Badge>}
                  />
                </RowItem>
              );
            })}
          </RowList>
        ) : (
          <p className="px-2 py-3 text-[13px] text-fg-muted">No finished runs yet.</p>
        )}
      </Panel>

      {stalled > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
          <LuCircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {stalled} run{stalled === 1 ? "" : "s"} lost their heartbeat (the server function was likely killed). Open the run to resume it.
        </p>
      )}
    </div>
  );
}
