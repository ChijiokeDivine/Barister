import type { Matter } from "../types";
import { cn } from "@/lib/cn";

const tones: Record<Matter["tone"], string> = {
  plum: "bg-tile-plum",
  teal: "bg-tile-teal",
  ink: "bg-tile-ink",
};

interface MatterTileProps {
  initial: string;
  tone: Matter["tone"];
  size?: "xs" | "sm";
  className?: string;
}

/** Small rounded letter tile identifying a matter. */
export function MatterTile({ initial, tone, size = "sm", className }: MatterTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[4px] font-semibold text-white",
        tones[tone],
        size === "sm" ? "size-[18px] text-[10px]" : "size-4 text-[9px]",
        className,
      )}
    >
      {initial}
    </span>
  );
}
