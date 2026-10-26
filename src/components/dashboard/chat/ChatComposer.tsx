"use client";

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
import type { Matter } from "../types";

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
      className="inline-flex size-8 items-center justify-center rounded-lg bg-fg text-[15px] text-white outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
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
  minRows?: number;
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
          "block w-full resize-none bg-transparent text-[14px] leading-6 text-fg outline-none placeholder:text-fg-muted",
          className,
        )}
      />
    </>
  );
}

function ModeButton() {
  return (
    <Tooltip label="Senior Partner" side="bottom">
      <IconButton label="Review mode" size="sm">
        <LuSlidersHorizontal />
      </IconButton>
    </Tooltip>
  );
}

/* ---------- Launcher variant (home) ---------- */

interface LauncherProps {
  matters: Matter[];
  models: readonly string[];
  placeholder?: string;
  onSubmit?: (payload: { text: string; matterId: string | null; model: string }) => void;
  className?: string;
}

/** Home composer: matter + model selectors above a roomy input. */
export function LauncherComposer({
  matters,
  models,
  placeholder = "Ask Barister anything",
  onSubmit,
  className,
}: LauncherProps) {
  const [text, setText] = useState("");
  const [matterId, setMatterId] = useState<string | null>(null);
  const [model, setModel] = useState<string>(models[0]);

  const matterOptions: DropdownOption[] = matters.map((m) => ({ value: m.id, label: m.name, hint: m.number }));
  const modelOptions: DropdownOption[] = models.map((m) => ({ value: m, label: m }));
  const canSend = text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSubmit?.({ text: text.trim(), matterId, model });
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
      <div className="flex h-10 items-center justify-between px-3">
        <Dropdown
          options={matterOptions}
          value={matterId}
          onChange={setMatterId}
          placeholder="Select a matter"
          icon={<LuBriefcase aria-hidden className="size-3.5" />}
          menuClassName="min-w-72"
        />
        <Dropdown
          options={modelOptions}
          value={model}
          onChange={setModel}
          placeholder="Model"
          align="right"
          icon={<LuSparkles aria-hidden className="size-3.5" />}
        />
      </div>

      <div className="rounded-2xl border-t border-line bg-canvas px-4 pb-3 pt-3.5 shadow-[0_1px_0_rgb(0_0_0/0.02)]">
        <Field value={text} onChange={setText} placeholder={placeholder} onEnter={submit} />
        <div className="mt-8 flex items-center justify-between">
          <IconButton label="Add sources" size="sm">
            <LuPlus />
          </IconButton>
          <div className="flex items-center gap-1">
            <ModeButton />
            {canSend ? (
              <SendButton />
            ) : (
              <IconButton label="Dictate" size="sm">
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
  onSubmit?: (text: string) => void;
  className?: string;
}

/** Composer scoped to one matter: number selector, linked space, send button. */
export function MatterComposer({
  matter,
  spaceName,
  placeholder = "Ask Barister anything",
  resources,
  size = "default",
  onSubmit,
  className,
}: MatterComposerProps) {
  const [text, setText] = useState("");
  const compact = size === "compact";

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit?.(t);
    setText("");
  };

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
      <div className={cn("flex items-center justify-between px-4", compact ? "h-10" : "h-11")}>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {matter.number}
          <LuChevronDown aria-hidden className="size-3.5" />
        </button>
        <span className="inline-flex items-center gap-2 text-[13px] text-fg-muted">
          <MatterTile initial={spaceName.charAt(0)} tone="teal" size="xs" />
          {spaceName}
        </span>
      </div>

      <div className="rounded-2xl bg-canvas px-4 pb-3 pt-3.5 shadow-[0_-1px_0_var(--color-line)]">
        {resources && !compact && <ResourceChip {...resources} />}
        <Field value={text} onChange={setText} placeholder={placeholder} onEnter={submit} className={resources && !compact ? "mt-3" : undefined} />
        <div className={cn("flex items-center justify-between", compact ? "mt-6" : "mt-7")}>
          <IconButton label="Add sources" size="sm">
            <LuPlus />
          </IconButton>
          <div className="flex items-center gap-1.5">
            <ModeButton />
            <SendButton />
          </div>
        </div>
      </div>
    </form>
  );
}

function ResourceChip({ count, vaults, queries }: { count: number; vaults: number; queries: number }): ReactNode {
  return (
    <div className="inline-flex items-center gap-3 rounded-lg bg-surface px-3.5 py-2.5">
      <LuPaperclip aria-hidden className="size-4 text-fg-muted" />
      <div className="leading-tight">
        <p className="text-[13px] font-medium text-fg">{count} resources</p>
        <p className="text-[12px] text-fg-muted">
          {vaults} vaults · {queries} queries
        </p>
      </div>
    </div>
  );
}
