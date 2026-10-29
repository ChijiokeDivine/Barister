"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LuArrowRight, LuEye, LuEyeOff } from "react-icons/lu";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/dashboard/ui/Button";
import { Field, Input, Label } from "@/components/dashboard/ui/Field";
import type { SessionUser } from "@/lib/auth/types";

type Mode = "sign-in" | "sign-up";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const COPY = {
  "sign-in": {
    eyebrow: "Welcome back",
    title: "Sign in to Barister",
    description: "Pick up your matters, documents and agent runs where you left off.",
    submit: "Sign in",
    switchText: "New to Barister?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
  },
  "sign-up": {
    eyebrow: "Get started",
    title: "Create your account",
    description: "Set up a workspace for your matters, vault and legal workflows.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
} as const;

function validate(mode: Mode, values: { name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "sign-up" && values.name.trim().length < 2) errors.name = "Enter your full name";
  if (!values.email.trim()) errors.email = "Enter your email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address";
  if (!values.password) errors.password = "Enter your password";
  else if (mode === "sign-up") {
    if (values.password.length < 8) errors.password = "Use at least 8 characters";
    else if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = "Include at least one letter and one number";
    }
  }
  return errors;
}

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Only relative paths are accepted, so `next` can never become an open redirect.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const values = { name, email, password };
    const fieldErrors = validate(mode, values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setPending(true);
    try {
      await api<{ user: SessionUser }>(`/api/auth/${mode}`, {
        method: "POST",
        json: mode === "sign-up" ? { name: values.name.trim(), email: values.email.trim(), password } : { email: values.email.trim(), password },
      });
      router.replace(safeNext);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">{copy.eyebrow}</p>
      <h1 className="mt-2 font-serif text-[30px] leading-[1.1] tracking-[-0.02em] text-[#0f0e0d]">{copy.title}</h1>
      <p className="mt-2 text-[13px] leading-5 text-[#6b6a67]">{copy.description}</p>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
        {formError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] leading-5 text-red-700">
            {formError}
          </div>
        )}

        {mode === "sign-up" && (
          <Field label="Full name" error={errors.name}>
            <Input
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Maya Sterling"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className="h-10"
            />
          </Field>
        )}

        <Field label="Email address" error={errors.email}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            className="h-10"
          />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              className="h-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-[15px] text-[#9b9a96] outline-none transition-colors hover:text-[#1a1a19] focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {showPassword ? <LuEyeOff aria-hidden /> : <LuEye aria-hidden />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-[12px] text-red-600">{errors.password}</p>
          ) : mode === "sign-up" ? (
            <p className="text-[11.5px] text-[#9b9a96]">At least 8 characters, with a letter and a number.</p>
          ) : null}
        </div>

        <Button type="submit" variant="primary" loading={pending} className="mt-1 h-10 w-full gap-2">
          {pending ? copy.submit : (
            <>
              {copy.submit} <LuArrowRight aria-hidden className="size-3.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-[#6b6a67]">
        {copy.switchText}{" "}
        <Link
          href={next ? `${copy.switchHref}?next=${encodeURIComponent(safeNext)}` : copy.switchHref}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
