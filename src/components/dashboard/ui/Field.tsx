import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line bg-white px-3 text-[13px] text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:bg-surface disabled:text-fg-muted";

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-[12px] font-medium text-fg-muted", className)}>
      {children}
    </label>
  );
}

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : hint ? <p className="text-[12px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 resize-y py-2 leading-5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-9 pr-2", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-2 text-[13px] text-fg", className)}>
      <input id={id} type="checkbox" className="size-3.5 rounded border-line accent-[var(--color-accent)]" {...rest} />
      {label}
    </label>
  );
}
