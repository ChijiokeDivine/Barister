"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  LuArrowUp,
  LuBriefcase,
  LuChevronDown,
  LuMic,
  LuPaperclip,
  LuPlus,
  LuSlidersHorizontal,
  LuSparkles,
} from "react-icons/lu";
import { cn } from "@/lib/cn";
import { IconButton } from "../ui/IconButton";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { MatterTile } from "../ui/MatterTile";
import { Tooltip } from "../ui/Tooltip";
import type { Matter, ModelOption } from "../types";

export type Tier = ModelOption["value"];

/* ---------- shared bits ---------- */

function useAutosize(value: string, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value, max]);
  return ref;
}

function SendButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      aria-label="Send"
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg bg-fg text-[15px] text-white outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40 sm:size-8"
    >
      <LuArrowUp aria-hidden />
    </button>
  );
}

interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter: () => void;
  max?: number;
  className?: string;
}

function Field({ value, onChange, placeholder, onEnter, max = 220, className }: FieldProps) {
  const ref = useAutosize(value, max);
  const id = useId();
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  };
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "block w-full resize-none bg-transparent text-[16px] leading-6 text-fg outline-none placeholder:text-fg-muted sm:text-[14px]",
          className,
        )}
      />
    </>
  );
}

const TIERS: DropdownOption[] = [
  { value: "auto", label: "Auto routing", hint: "Best available" },
  { value: "long", label: "Deep context", hint: "Gemini" },
  { value: "fast", label: "Fast", hint: "Groq" },
];

function ModeButton({ tier, onChange }: { tier: Tier; onChange: (t: Tier) => void }) {
  return (
    <Tooltip label="Model routing" side="bottom">
      <Dropdown
        options={TIERS}
        value={tier}
        onChange={(v) => onChange(v as Tier)}
        placeholder="Auto"
        align="right"
        menuClassName="min-w-52"
        triggerClassName="size-7 justify-center px-0 text-fg-muted max-lg:size-8"
        renderValue={() => <LuSlidersHorizontal aria-hidden className="size-[15px]" />}
      />
    </Tooltip>
  );
}

/* ---------- Launcher variant (home) ---------- */

export interface LauncherPayload {
  text: string;
  matterId: string | null;
  tier: Tier;
}

interface LauncherProps {
  matters: Matter[];
  models: readonly ModelOption[];
  placeholder?: string;
  onSubmit?: (payload: LauncherPayload) => void;
  className?: string;
}

/** Home composer: matter + model selectors above a roomy input. */
export function LauncherComposer({ matters, models, placeholder = "Ask Barister anything", onSubmit, className }: LauncherProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [matterId, setMatterId] = useState<string | null>(matters[0]?.id ?? null);
  const [tier, setTier] = useState<Tier>(models[0]?.value ?? "auto");

  const matterOptions: DropdownOption[] = matters.map((m) => ({ value: m.id, label: m.name, hint: m.number }));
  const modelOptions: DropdownOption[] = models.map((m) => ({ value: m.value, label: m.label }));
  const canSend = text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    const payload = { text: text.trim(), matterId, tier };
    if (onSubmit) onSubmit(payload);
    else {
      const params = new URLSearchParams({ q: payload.text, tier: payload.tier });
      if (payload.matterId) params.set("matter", payload.matterId);
      router.push(`/chat?${params.toString()}`);
    }
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}
    >
      <div className="flex h-11 items-center justify-between gap-2 px-2.5 sm:h-10 sm:gap-0 sm:px-3">
        <Dropdown
          options={matterOptions}
          value={matterId}
          onChange={setMatterId}
          placeholder="Select a matter"
          icon={<LuBriefcase aria-hidden className="size-3.5" />}
          className="min-w-0"
          menuClassName="min-w-72 max-w-[calc(100vw-2rem)]"
        />
        <Dropdown
          options={modelOptions}
          value={tier}
          onChange={(v) => setTier(v as Tier)}
          placeholder="Model"
          align="right"
          icon={<LuSparkles aria-hidden className="size-3.5" />}
          className="shrink-0"
        />
      </div>

      <div className="rounded-2xl border-t border-line bg-canvas px-3 pb-3 pt-3 shadow-[0_1px_0_rgb(0_0_0/0.02)] sm:px-4 sm:pt-3.5">
        <Field value={text} onChange={setText} placeholder={placeholder} onEnter={submit} />
        <div className="mt-6 flex items-center justify-between sm:mt-8">
          <IconButton label="Add sources" size="sm" className="max-lg:size-8">
            <LuPlus />
          </IconButton>
          <div className="flex items-center gap-1">
            <ModeButton tier={tier} onChange={setTier} />
            {canSend ? (
              <SendButton />
            ) : (
              <IconButton label="Dictate" size="sm" className="max-lg:size-8">
                <LuMic />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

/* ---------- Matter variant ---------- */

interface MatterComposerProps {
  matter: Matter;
  /** Space label shown top-right. */
  spaceName: string;
  placeholder?: string;
  /** Resource chip (full size only). */
  resources?: { count: number; vaults: number; queries: number };
  size?: "default" | "compact";
  /** Optional matter switcher (chat page); otherwise the number links to the matter. */
  matters?: Matter[];
  onMatterChange?: (id: string) => void;
  onSubmit?: (payload: { text: string; tier: Tier }) => void;
  className?: string;
}

/** Composer scoped to one matter: number selector, linked space, send button. */
export function MatterComposer({
  matter,
  spaceName,
  placeholder = "Ask Barister anything",
  resources,
  size = "default",
  matters,
  onMatterChange,
  onSubmit,
  className,
}: MatterComposerProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [tier, setTier] = useState<Tier>("auto");
  const compact = size === "compact";
  const canSend = text.trim().length > 0;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    if (onSubmit) onSubmit({ text: t, tier });
    else {
      const params = new URLSearchParams({ q: t, tier, matter: matter.id, sources: "vault" });
      router.push(`/chat?${params.toString()}`);
    }
    setText("");
  };

  const matterOptions: DropdownOption[] = (matters ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.number }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "overflow-hidden rounded-2xl bg-surface",
        compact ? "border border-line" : "border border-line/70 shadow-card",
        className,
      )}
    >
      <div className={cn("flex items-center justify-between gap-3 px-3 sm:px-4", compact ? "h-10" : "h-11")}>
        {matters && matters.length > 1 && onMatterChange ? (
          <Dropdown
            options={matterOptions}
            value={matter.id}
            onChange={onMatterChange}
            placeholder={matter.number}
            triggerClassName="text-accent font-medium"
            menuClassName="min-w-72 max-w-[calc(100vw-2rem)]"
            renderValue={() => (
              <span className="inline-flex min-w-0 items-center gap-1 text-[13px] font-medium text-accent">
                <span className="truncate">{matter.number}</span>
                <LuChevronDown aria-hidden className="size-3.5 shrink-0" />
              </span>
            )}
          />
        ) : (
          <Link
            href={`/cases/${matter.id}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {matter.number}
            <LuChevronDown aria-hidden className="size-3.5" />
          </Link>
        )}
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-fg-muted">
          <MatterTile initial={spaceName.charAt(0)} tone="teal" size="xs" />
          <span className="truncate">{spaceName}</span>
        </span>
      </div>

      <div className="rounded-2xl bg-canvas px-3 pb-3 pt-3.5 shadow-[0_-1px_0_var(--color-line)] sm:px-4">
        {resources && !compact && <ResourceChip {...resources} />}
        <Field value={text} onChange={setText} placeholder={placeholder} onEnter={submit} className={resources && !compact ? "mt-3" : undefined} />
        <div className={cn("flex items-center justify-between", compact ? "mt-5 sm:mt-6" : "mt-6 sm:mt-7")}>
          <IconButton label="Add sources" size="sm" className="max-lg:size-8">
            <LuPlus />
          </IconButton>
          <div className="flex items-center gap-1.5">
            <ModeButton tier={tier} onChange={setTier} />
            <SendButton disabled={!canSend} />
          </div>
        </div>
      </div>
    </form>
  );
}

function ResourceChip({ count, vaults, queries }: { count: number; vaults: number; queries: number }): ReactNode {
  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-lg bg-surface px-3 py-2.5 sm:px-3.5">
      <LuPaperclip aria-hidden className="size-4 shrink-0 text-fg-muted" />
      <div className="min-w-0 leading-tight">
        <p className="text-[13px] font-medium text-fg">{count} resources</p>
        <p className="text-[12px] text-fg-muted">
          {vaults} vaults · {queries} queries
        </p>
      </div>
    </div>
  );
}
