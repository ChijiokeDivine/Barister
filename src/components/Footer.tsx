import Link from "next/link";
import { FiArrowUpRight, FiArrowUp } from "react-icons/fi";

const noiseTexture =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E\")";

const exploreLinks = [
  { label: "Overview", href: "#top" },
  { label: "Platform", href: "/workflows" },
  { label: "Customer stories", href: "/cases" },
];

export default function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#1F1D1A] text-[#F4F0E8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] mix-blend-soft-light"
        style={{ backgroundImage: noiseTexture }}
      />

      <div className="mx-auto max-w-[1320px] px-5 md:px-11">
        <div className="flex flex-col gap-7 border-b border-white/15 py-12 sm:flex-row sm:items-end sm:justify-between md:py-16">
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#C9A982]">
              Barister
            </p>
            <h2 className="max-w-xl text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">
              Make complex legal work feel clear.
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-3 border border-[#F4F0E8]/35 px-5 py-3 text-sm transition-colors hover:border-[#F4F0E8] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A982]"
          >
            Request a demo
            <FiArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-12 md:gap-8 md:py-14">
          <div className="md:col-span-6">
            <Link
              href="#top"
              className="inline-block text-3xl tracking-[-0.04em] text-[#F4F0E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A982]"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            >
              Barister
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#F4F0E8]/65">
              Legal agents and workflows built to help teams find the facts and
              move important work forward.
            </p>
          </div>

          <nav aria-label="Footer" className="sm:col-span-1 md:col-span-3">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[#F4F0E8]/45">
              Explore
            </h3>
            <ul className="flex flex-col items-start gap-3">
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#F4F0E8]/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A982]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sm:col-span-1 md:col-span-3">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[#F4F0E8]/45">
              Get started
            </h3>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-[#F4F0E8]/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A982]"
            >
              Talk to our team
              <FiArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/15 py-5 text-xs text-[#F4F0E8]/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Barister. All rights reserved.</p>
          <Link
            href="#top"
            className="inline-flex w-fit items-center gap-2 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A982]"
          >
            Back to top
            <FiArrowUp aria-hidden="true" size={13} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
