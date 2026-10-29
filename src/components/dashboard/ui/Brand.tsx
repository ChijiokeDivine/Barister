import { cn } from "@/lib/cn";

/** Serif wordmark used in the expanded sidebar. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif text-[22px] leading-none tracking-[-0.01em] text-[#000000]", className)}>
      Barister
    </span>
  );
}

/** Square logo mark used in the collapsed rail. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-[5px] bg-white text-[12px] font-bold text-black",
        className,
      )}
    >
      B
    </span>
  );
}
