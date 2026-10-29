import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign in · Barister",
  description: "Sign in to your Barister workspace.",
};

// Reads the `next` query param, so render per request instead of prerendering.
export const instant = false;

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />;
}
