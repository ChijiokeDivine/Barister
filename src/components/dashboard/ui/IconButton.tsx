import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  children: ReactNode;
  tone?: "light" | "dark";
  size?: "sm" | "md";
}

export function IconButton({
  label,
  children,
  tone = "light",
  size = "md",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        size === "sm" ? "size-7 text-[15px]" : "size-8 text-[17px]",
        tone === "light"
          ? "text-fg-muted hover:bg-surface-strong hover:text-fg"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg focus-visible:ring-white/30",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
