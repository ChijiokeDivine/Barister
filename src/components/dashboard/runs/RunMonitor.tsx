"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LuBan, LuBot, LuRotateCcw, LuWifi } from "react-icons/lu";
import { api, sse } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { RunLogEntry } from "@/lib/ui/types";
import type { RunStatus } from "@/lib/services/runs";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { runLabel, runTone } from "@/lib/ui/status";

interface RunMonitorProps {
  runId: string;
  initialLogs: RunLogEntry[];
  initialCursor: number;
  initialStatus: RunStatus;
  resumable: boolean;
}

const LEVEL: Record<RunLogEntry["level"], string> = {
  info: "text-fg-muted",
  decision: "text-accent",
  warn: "text-amber-700",
  error: "text-red-700",
};

const TERMINAL: RunStatus[] = ["succeeded", "failed", "cancelled"];

/** Tails the run log over SSE, with cancel/resume controls. */
export function RunMonitor({ runId, initialLogs, initialCursor, initialStatus, resumable }: RunMonitorProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<RunLogEntry[]>(initialLogs);
  const [status, setStatus] = useState<RunStatus>(initialStatus);
  const [canResume, setCanResume] = useState(resumable);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [stick, setStick] = useState(true);
  const cursor = useRef(initialCursor);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let done = false;
    let controller: AbortController | null = null;

    const loop = async () => {
      while (active && !done) {
        controller = new AbortController();
        await sse(
          `/api/runs/${runId}/stream?after=${cursor.current}`,
          { method: "GET" },
          {
            signal: controller.signal,
            onEvent: (event, data) => {
              const payload = (data ?? {}) as Record<string, unknown>;
              if (event === "log") {
                const entry = payload.entry as RunLogEntry | undefined;
                if (entry) setLogs((prev) => [...prev, entry]);
                if (typeof payload.cursor === "number") cursor.current = payload.cursor;
              } else if (event === "status") {
                const next = String(payload.status ?? "") as RunStatus;
                if (next) setStatus(next);
              } else if (event === "end") {
                done = true;
                const next = String(payload.status ?? "") as RunStatus;
                if (next) setStatus(next);
                setCanResume(next === "failed" || next === "cancelled");
                router.refresh();
              }
            },
            onError: (e) => {
              if (active) setError(e.message);
            },
          },
        );
        if (!active || done) break;
        await new Promise((r) => setTimeout(r, 900));
      }
    };

    if (!TERMINAL.includes(initialStatus)) void loop();
    return () => {
      active = false;
      controller?.abort();
    };
  }, [initialStatus, router, runId, streamKey]);

  useEffect(() => {
    if (stick) bottom.current?.scrollIntoView({ block: "end" });
  }, [logs, stick]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const cancel = async () => {
    setBusy("cancel");
    setError(null);
    try {
      await api(`/api/runs/${runId}/cancel`, { method: "POST" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel the run.");
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    setBusy("resume");
    setError(null);
    try {
      await api(`/api/runs/${runId}/resume`, { method: "POST" });
      setStatus("running");
      setCanResume(false);
      setStreamKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume the run.");
    } finally {
      setBusy(null);
    }
  };

  const live = !TERMINAL.includes(status);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge tone={runTone[status]}>{runLabel[status]}</Badge>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted">
              <LuWifi aria-hidden className="size-3.5 text-accent" /> Live
            </span>
          )}
          <span className="text-[11.5px] text-fg-subtle">{logs.length} log lines</span>
        </div>
        <div className="flex items-center gap-1.5">
          {live && (
            <Button variant="danger" size="sm" onClick={cancel} loading={busy === "cancel"}>
              <LuBan aria-hidden className="size-3.5" /> Cancel
            </Button>
          )}
          {canResume && (
            <Button variant="secondary" size="sm" onClick={resume} loading={busy === "resume"}>
              <LuRotateCcw aria-hidden className="size-3.5" /> Resume
            </Button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="border-b border-line bg-red-50 px-4 py-2 text-[12px] text-red-700">{error}</p>}

      <div ref={scroller} onScroll={onScroll} className="scroll-quiet max-h-[560px] min-h-[240px] overflow-y-auto px-4 py-3">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-fg-muted">No log lines yet. The orchestrator is starting.</p>
        ) : (
          <ol className="space-y-2.5">
            {logs.map((entry, i) => (
              <li key={`${entry.ts}-${i}`} className="flex gap-2.5">
                <span aria-hidden className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-surface text-[10px] text-fg-muted">
                  <LuBot />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[12px] font-medium text-fg">{entry.agent}</span>
                    <span className="text-[10.5px] text-fg-subtle">
                      {new Date(entry.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </span>
                    {entry.level !== "info" && <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{entry.level}</span>}
                  </div>
                  <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-5", LEVEL[entry.level])}>{entry.message}</p>
                  {entry.data != null && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-fg-subtle hover:text-fg">Details</summary>
                      <pre className="scroll-quiet mt-1 max-h-48 overflow-auto rounded-md bg-surface p-2 font-mono text-[10.5px] leading-5 text-fg-muted">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
