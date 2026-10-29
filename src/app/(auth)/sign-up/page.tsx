import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Create account · Barister",
  description: "Create your Barister account.",
};

// Reads the `next` query param, so render per request instead of prerendering.
export const instant = false;

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" next={typeof next === "string" ? next : undefined} />;
}
