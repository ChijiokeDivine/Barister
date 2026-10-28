import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneClass, type Tone } from "@/lib/ui/status";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", toneClass[tone], className)}>
      {children}
    </span>
  );
}
