"use client";

import { useEffect, type ReactNode } from "react";
import { LuX } from "react-icons/lu";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

/** Accessible dialog shell: Escape/backdrop closes, background scroll locks. */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[1px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-canvas shadow-pop sm:rounded-xl", widths[size])}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id="modal-title" className="font-serif text-[19px] leading-tight text-fg">
              {title}
            </h2>
            {description && <p className="mt-1 text-[12.5px] leading-5 text-fg-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[16px] text-fg-muted outline-none transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <LuX />
          </button>
        </header>
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface/60 px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </div>
  );
}
