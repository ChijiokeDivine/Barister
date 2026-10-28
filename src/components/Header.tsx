"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaCaretDown, FaCaretRight, FaCaretUp } from "react-icons/fa";
import { FiArrowRight, FiX } from "react-icons/fi";
import Logo from "./Logo";
import { FadeIn } from "./Reveal";

type Group = { label: string; links: { label: string; href: string }[] };
type Item = { id: string; label: string; groups: Group[] };

// Product-led menu. Hrefs are placeholders until the routes exist.
const MENU: Item[] = [
  {
    id: "platform",
    label: "Platform",
    groups: [
      {
        label: "Build",
        links: [
          { label: "Workflow Builder", href: "/workflows" },
          { label: "Multi-Agent Workflows", href: "/agents" },
          { label: "Legal Agent Workspace", href: "/dashboard" },
        ],
      },
      {
        label: "Trust",
        links: [
          { label: "Data Privacy", href: "/audit-trail" },
          { label: "Security", href: "/settings" },
        ],
      },
    ],
  },
  {
    id: "solutions",
    label: "Use Cases",
    groups: [
      {
        label: "Litigation",
        links: [
          { label: "Deposition Preparation", href: "/cases" },
          { label: "Discovery Analysis", href: "/vault" },
        ],
      },
      {
        label: "Transactional",
        links: [
          { label: "Contract Analysis", href: "/workflows" },
          { label: "Due Diligence", href: "/cases" },
        ],
      },
    ],
  },
];

export default function Header() {
  const [open, setOpen] = useState<string | null>(null); // desktop dropdown
  const [menu, setMenu] = useState(false); // mobile overlay
  const [sub, setSub] = useState<string | null>(null); // mobile accordion

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(null), setMenu(false));
    const onResize = () => window.innerWidth >= 1024 && setMenu(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  return (
    <header className="absolute inset-x-0 top-0 z-50 flex h-20 items-center justify-between px-5 md:h-[82px] md:px-11">
      <FadeIn delay={900} y={0}>
        <Link href="/" className="block">
          <Logo />
        </Link>
      </FadeIn>

      {/* Desktop nav */}
      <FadeIn delay={1000} y={0} className="hidden lg:block">
        <nav
          aria-label="Primary"
          className="relative flex items-center bg-[#0f0E0D] p-[3px]"
          onMouseLeave={() => setOpen(null)}
        >
          {MENU.map((item) => {
            const active = open === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-expanded={active}
                aria-haspopup="true"
                onMouseEnter={() => setOpen(item.id)}
                onClick={() => setOpen(active ? null : item.id)}
                className={`flex h-10 items-center gap-1.5 px-[17px] text-[16px] font-medium tracking-[-0.01em] transition-colors duration-300 ${
                  active ? "bg-[#0f0E0D] text-[#f9f7f3]" : "hover:bg-white/5"
                } ${open && !active ? "text-[#f9f7f3]/50" : "text-[#f9f7f3]"}`}
              >
                {item.label}
                {active ? <FaCaretUp size={10} /> : <FaCaretDown size={10} />}
              </button>
            );
          })}
          <Link
            href="/dashboard"
            onMouseEnter={() => setOpen(null)}
            className="flex h-10 items-center bg-[#f9f7f3] px-[18px] text-[16px] font-medium tracking-[-0.01em] text-[#2b2523] transition-colors hover:bg-white"
          >
            Start building
          </Link>

          {MENU.map((item) => (
            <div
              key={item.id}
              role="menu"
              aria-hidden={open !== item.id}
              className={`absolute right-11 top-[calc(100%-4px)] flex bg-[#f9f7f3] py-[27px] text-[#2b2523] transition-all duration-300 ease-out ${
                open === item.id ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
              }`}
            >
              {item.groups.map((g, i) => (
                <div
                  key={g.label}
                  className={
                    i === 0
                      ? `min-w-[205px] pl-[35px] ${item.groups.length === 1 ? "pr-[40px]" : ""}`
                      : "border-l border-[#ecd5c6] pl-[54px] pr-[35px]"
                  }
                >
                  <p className="text-[14.5px] leading-[18px] text-[#8a8581]">{g.label}</p>
                  <ul className="mt-[30px] flex flex-col gap-[11px]">
                    {g.links.map((l) => (
                      <li key={l.label}>
                        <Link
                          href={l.href}
                          className="group flex items-center gap-1.5 whitespace-nowrap text-[17px] leading-5 tracking-[-0.01em]"
                        >
                          {l.label}
                          <FiArrowRight
                            size={14}
                            strokeWidth={1.6}
                            className="transition-transform duration-300 group-hover:translate-x-0.5"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </FadeIn>

      {/* Mobile hamburger */}
      <FadeIn delay={1000} y={0} className="lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenu(true)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[9px] bg-[#0f0E0D]"
        >
          <span className="h-px w-5 bg-[#f9f7f3]" />
          <span className="h-px w-5 bg-[#f9f7f3]" />
        </button>
      </FadeIn>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[60] overflow-y-auto bg-[#f9f7f3] text-[#231f1e] transition-opacity duration-300 lg:hidden ${
          menu ? "visible opacity-100" : "invisible opacity-0"
        }`}
        aria-hidden={!menu}
      >
        <div className="flex h-20 items-center justify-between px-5">
          <Link href="/" onClick={() => setMenu(false)}>
            <Logo tone="dark" />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenu(false)}
            className="flex h-10 w-10 items-center justify-center bg-[#e4e2df]"
          >
            <FiX size={26} strokeWidth={1} />
          </button>
        </div>

        <ul className="mt-[18px] px-5">
          {MENU.map((item) => {
            const expanded = sub === item.id;
            return (
              <li key={item.id} className="border-b-2 border-[#e2d8c0]">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setSub(expanded ? null : item.id)}
                  className="flex h-[69px] w-full items-center justify-between text-left text-[28px] tracking-[-0.02em]"
                >
                  {item.label}
                  <FaCaretRight
                    size={14}
                    className={`transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    expanded ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {item.groups.map((g) => (
                      <div key={g.label} className="mb-3">
                        <p className="mb-2 text-[14px] text-[#8a8581]">{g.label}</p>
                        <ul className="flex flex-col gap-3">
                          {g.links.map((l) => (
                            <li key={l.label}>
                              <Link href={l.href} onClick={() => setMenu(false)} className="text-[19px]">
                                {l.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
          <li className="border-b-2 border-[#e2d8c0]">
            <Link
              href="/dashboard"
              onClick={() => setMenu(false)}
              className="flex h-[69px] items-center text-[28px] tracking-[-0.02em]"
            >
              Book a demo
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}