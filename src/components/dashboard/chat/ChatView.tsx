"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LuArrowUp, LuBot, LuBriefcase, LuPlus, LuSlidersHorizontal, LuSparkles, LuSquare, LuTrash2, LuWand } from "react-icons/lu";
import { cn } from "@/lib/cn";
import { api, sse } from "@/lib/client/api";
import type { ChatMessageDTO } from "@/lib/ui/types";
import type { Matter, ModelOption } from "../types";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { IconButton } from "../ui/IconButton";
import { MatterTile } from "../ui/MatterTile";
import { QuickSources } from "./QuickSources";
import { DEFAULT_SOURCES, QUICK_SOURCES, type SourceId } from "./sources";

export interface ChatInitial {
  id: string;
  caseId: string | null;
  title: string;
  messages: ChatMessageDTO[];
  docIds: string[];
}

interface ChatViewProps {
  initial?: ChatInitial;
  matters: Matter[];
  models: ModelOption[];
  autoQuery?: string;
  autoMatter?: string | null;
  autoTier?: ModelOption["value"];
  autoSources?: string[];
}

const TIERS: DropdownOption[] = [
  { value: "auto", label: "Auto routing", hint: "Best available" },
  { value: "long", label: "Deep context", hint: "Gemini" },
  { value: "fast", label: "Fast", hint: "Groq" },
];

const STATUS_LABEL: Record<string, string> = {
  building_workflow: "Building a workflow…",
  context_truncated: "Documents truncated to fit the model…",
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Streams one conversation turn and renders the thread. */
export function ChatView({ initial, matters, models, autoQuery, autoMatter, autoTier, autoSources }: ChatViewProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageDTO[]>(initial?.messages ?? []);
  const [conversationId, setConversationId] = useState<string | null>(initial?.id ?? null);
  const [caseId, setCaseId] = useState<string | null>(initial?.caseId ?? autoMatter ?? null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState("");
  const [tier, setTier] = useState<ModelOption["value"]>(autoTier ?? "auto");
  const [sources, setSources] = useState<string[]>(() => {
    const fromUrl = (autoSources ?? []).filter((s): s is SourceId => QUICK_SOURCES.some((q) => q.id === s));
    return fromUrl.length ? fromUrl : DEFAULT_SOURCES;
  });
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);
  const matter = caseId ? matters.find((m) => m.id === caseId) ?? null : null;
  const modelOptions: DropdownOption[] = models.length ? models.map((m) => ({ value: m.value, label: m.label })) : TIERS;

  const send = useCallback(
    (raw: string) => {
      const message = raw.trim();
      if (!message || streaming) return;
      setError(null);
      setStatus(null);
      setText("");
      setStreaming(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: message, ts: new Date().toISOString() },
        { role: "assistant", content: "", ts: new Date().toISOString() },
      ]);
      if (!title) setTitle(message.replace(/\s+/g, " ").slice(0, 60));

      const controller = new AbortController();
      abortRef.current = controller;
      let nextId = conversationId;

      const patchLast = (patch: (m: ChatMessageDTO) => ChatMessageDTO) =>
        setMessages((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          next[next.length - 1] = patch(next[next.length - 1]!);
          return next;
        });

      void sse(
        "/api/chat",
        {
          method: "POST",
          json: { message, conversationId: conversationId ?? undefined, caseId, tier, sources, docIds: initial?.docIds },
        },
        {
          signal: controller.signal,
          onEvent: (event, data) => {
            const payload = (data ?? {}) as Record<string, unknown>;
            if (event === "meta") {
              nextId = String(payload.conversationId ?? "");
              if (nextId) setConversationId(nextId);
              if (payload.caseId === null || typeof payload.caseId === "string") setCaseId(payload.caseId);
            } else if (event === "status") {
              setStatus(STATUS_LABEL[String(payload.stage)] ?? null);
            } else if (event === "delta") {
              const chunk = String(payload.text ?? "");
              if (chunk) patchLast((m) => ({ ...m, content: m.content + chunk }));
            } else if (event === "workflow") {
              const workflow = payload as ChatMessageDTO["workflow"];
              if (workflow) patchLast((m) => ({ ...m, workflow }));
            } else if (event === "done") {
              setStreaming(false);
              setStatus(null);
              const id = String(payload.conversationId ?? nextId ?? "");
              if (id && id !== initial?.id) router.replace(`/chat/${id}`);
            } else if (event === "error") {
              setStreaming(false);
              setStatus(null);
              setError(String(payload.message ?? "The assistant could not finish this turn."));
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
              });
            }
          },
          onError: (err) => {
            setStreaming(false);
            setStatus(null);
            setError(err.message);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
            });
          },
        },
      );
    },
    [caseId, conversationId, initial?.docIds, initial?.id, router, sources, streaming, tier, title],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!autoQuery || autoSent.current) return;
    autoSent.current = true;
    sendRef.current(autoQuery);
  }, [autoQuery]);

  useEffect(() => {
    if (!streaming) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus(null);
  };

  const remove = async () => {
    if (!conversationId) return;
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      await api(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
      router.push("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the conversation.");
    }
  };

  const openDraft = (workflow: NonNullable<ChatMessageDTO["workflow"]>) => {
    try {
      sessionStorage.setItem("barister.workflow.draft", JSON.stringify(workflow));
    } catch {
      setError("The browser blocked local storage, so the draft could not be handed to the builder.");
      return;
    }
    router.push("/workflows/new?draft=1");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  };

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
      className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-card", messages.length === 0 && "w-full")}
    >
      <div className="flex h-10 items-center justify-between gap-2 px-3">
        {matter ? (
          <Link href={`/cases/${matter.id}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-md text-[12.5px] font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <LuBriefcase aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{matter.number}</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <LuBriefcase aria-hidden className="size-3.5" /> No matter
          </span>
        )}
        <Dropdown
          options={modelOptions}
          value={tier}
          onChange={(v) => setTier(v as ModelOption["value"])}
          placeholder="Model"
          align="right"
          icon={<LuSparkles aria-hidden className="size-3.5" />}
          className="shrink-0"
        />
      </div>
      <div className="rounded-2xl border-t border-line bg-canvas px-3 pb-3 pt-3 sm:px-4">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={messages.length === 0 ? 3 : 1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Barister anything"
          className="block max-h-[220px] w-full resize-none bg-transparent text-[15px] leading-6 text-fg outline-none placeholder:text-fg-muted"
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-subtle">
            <LuPlus aria-hidden className="size-3.5" /> {sources.length ? `${sources.length} source${sources.length === 1 ? "" : "s"}` : "No sources"}
          </span>
          <div className="flex items-center gap-1.5">
            <Dropdown
              options={TIERS}
              value={tier}
              onChange={(v) => setTier(v as ModelOption["value"])}
              placeholder="Auto"
              align="right"
              menuClassName="min-w-52"
              triggerClassName="size-7 justify-center px-0 text-fg-muted"
              renderValue={() => <LuSlidersHorizontal aria-hidden className="size-[15px]" />}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-white text-[13px] text-fg outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <LuSquare aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={!text.trim()}
                className="inline-flex size-8 items-center justify-center rounded-lg bg-fg text-[15px] text-white outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              >
                <LuArrowUp aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );

  const sourcesRow = (
    <QuickSources
      sources={QUICK_SOURCES}
      selected={sources}
      onToggle={(id) => setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))}
      className="mt-3"
    />
  );

  if (messages.length === 0) {
    return (
      <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-4 pb-14 sm:px-6 lg:pb-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_45%,#e6eaea_0%,transparent_70%)]" />
        <div className="relative flex w-full max-w-[560px] flex-col items-center">
          <p className="text-[13px] uppercase tracking-[0.14em] text-fg-subtle">New thread</p>
          <h1 className="mt-2 text-balance text-center font-serif text-[26px] leading-tight text-fg sm:text-[30px]">
            {matter ? `Let's work on ${matter.name}` : "What are we working on?"}
          </h1>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {error}
            </p>
          )}
          <div className="mt-7 w-full">{composer}</div>
          {sourcesRow}
          <p className="mt-4 text-center text-[11.5px] leading-5 text-fg-subtle">
            Answers are grounded in redacted matter documents. You remain responsible for verifying every result.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-sm sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-[13px] text-fg-muted">
            <LuBot />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[13.5px] font-medium text-fg">{title || "Thread"}</h1>
            {matter && (
              <Link href={`/cases/${matter.id}`} className="flex items-center gap-1 text-[11.5px] text-fg-muted transition-colors hover:text-accent">
                <MatterTile initial={matter.initial} tone={matter.tone} size="xs" />
                <span className="truncate">{matter.number} · {matter.name}</span>
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/chat"
            className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-fg-muted outline-none transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            New
          </Link>
          {conversationId && (
            <IconButton label="Delete conversation" size="sm" onClick={remove} className="text-fg-muted hover:text-red-600">
              <LuTrash2 />
            </IconButton>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <ol className="space-y-7">
          {messages.map((m, i) => (
            <li key={`${m.ts}-${i}`} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && (
                <span aria-hidden className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-[13px] text-fg-muted">
                  <LuBot />
                </span>
              )}
              <div className={cn("min-w-0 max-w-full", m.role === "user" ? "rounded-xl bg-surface px-3.5 py-2.5" : "flex-1")}>
                <p className={cn("whitespace-pre-wrap break-words text-[14px] leading-7 text-fg", !m.content && streaming && "text-fg-muted")}>
                  {m.content || (streaming && i === messages.length - 1 ? status ?? "Thinking…" : "")}
                </p>
                {m.workflow && (
                  <div className="mt-3 rounded-xl border border-accent/25 bg-accent/[0.04] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span aria-hidden className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[13px] text-accent">
                        <LuWand />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-fg">{m.workflow.name}</p>
                        <p className="mt-0.5 text-[12px] leading-5 text-fg-muted">{m.workflow.description}</p>
                        <p className="mt-1 text-[11px] text-fg-subtle">
                          {m.workflow.graph.nodes.length} nodes · {m.workflow.graph.edges.length} connections
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDraft(m.workflow!)}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-fg px-3 text-[12px] font-medium text-white outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      <LuWand aria-hidden className="size-3.5" /> Open in builder
                    </button>
                  </div>
                )}
                <p className="mt-1.5 text-[10.5px] text-fg-subtle">{timeOf(m.ts)}</p>
              </div>
            </li>
          ))}
        </ol>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="sticky bottom-0 z-20 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[760px]">
          {composer}
          <QuickSources
            sources={QUICK_SOURCES.filter((s) => s.available)}
            selected={sources}
            onToggle={(id) => setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))}
            className="mt-2 hidden sm:grid-cols-4 lg:grid"
          />
        </div>
      </div>
    </div>
  );
}
