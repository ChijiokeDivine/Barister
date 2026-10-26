import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "bottom" | "right" | "top";
  className?: string;
}

/** CSS-only tooltip: shows on hover and keyboard focus, no JS state. */
export function Tooltip({ label, children, side = "bottom", className }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-white/10 bg-tip px-3 py-1.5 text-[13px] font-medium text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "bottom" && "left-1/2 top-full mt-2 -translate-x-1/4",
          side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
          side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
