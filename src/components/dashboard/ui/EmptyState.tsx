import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center", className)}>
      {icon && <span aria-hidden className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-surface text-[18px] text-fg-muted">{icon}</span>}
      <h3 className="font-serif text-[17px] leading-tight text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-5 text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
