import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-white shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-black",
  secondary: "border border-line bg-white text-fg hover:bg-surface",
  ghost: "text-fg-muted hover:bg-surface hover:text-fg",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cn("inline-block size-4 animate-spin rounded-full border-2 border-fg-subtle border-r-transparent", className)} />;
}
