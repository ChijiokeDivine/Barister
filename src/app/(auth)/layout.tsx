import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/dashboard/ui/Brand";

/** Two-column frame for the sign-in and sign-up pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-[#f9f7f3] text-[#0f0e0d]">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#3b1315] p-10 text-[#f9f7f3] lg:flex xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/4 size-[420px] rounded-full bg-[#f9f7f3]/[0.04] blur-3xl" />
        <Link href="/" aria-label="Barister home" className="relative w-fit rounded outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <Wordmark className="text-[26px]" />
        </Link>

        <div className="relative max-w-[380px]">
          <p className="font-serif text-[clamp(30px,3.2vw,44px)] leading-[1.08] tracking-[-0.025em]">
            Complex legal work,
            <br />
            one clear workspace.
          </p>
          <p className="mt-5 text-[13.5px] leading-6 text-[#f9f7f3]/60">
            Connect agents to your documents, surface contradictions, and turn thousands of pages into work you can defend.
          </p>
        </div>

      </aside>

      <main className="flex min-h-dvh flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <Link href="/" aria-label="Barister home" className="rounded outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <Wordmark className="text-[22px] text-[#0f0e0d]" />
          </Link>
          <Link href="/" className="text-[12px] text-[#6b6a67] transition-colors hover:text-[#0f0e0d]">
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <div className="px-5 pb-6 text-center text-[11px] text-[#9b9a96] sm:px-8">
          By continuing you agree to keep client data confidential and use Barister only for authorised matters.
        </div>
      </main>
    </div>
  );
}
