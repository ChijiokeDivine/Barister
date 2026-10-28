import type { RunStatus } from "@/lib/services/runs";

export type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "info";

export const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-strong text-fg-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
};

export const runTone: Record<RunStatus, Tone> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warn",
};

export const runLabel: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const anchorTone: Record<string, Tone> = {
  pending: "warn",
  confirmed: "success",
  failed: "danger",
};

export const riskTone: Record<string, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warn",
  low: "success",
};

export const severityTone: Record<string, Tone> = {
  high: "danger",
  medium: "warn",
  low: "info",
};
