"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const reducedSnapshot = () => window.matchMedia(REDUCED_QUERY).matches;

/** Reveals once when the element enters the viewport. Respects reduced motion. */
function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedSnapshot, () => false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, reduced]);

  return { ref, shown: shown || reduced, reduced };
}

/** Subtle fade (with an optional tiny rise). Use y={0} for opacity only. */
export function FadeIn({
  children,
  delay = 0,
  y = 8,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const { ref, shown, reduced } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown || y === 0 ? undefined : `translateY(${y}px)`,
        transition: reduced ? "none" : `opacity 900ms ${EASE}, transform 900ms ${EASE}`,
        transitionDelay: reduced ? undefined : `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Word-by-word masked slide-up. `lines` keeps the design's exact line breaks. */
export function RevealWords({
  lines,
  delay = 0,
  stagger = 110,
  className = "",
}: {
  lines: string[][];
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const { ref, shown, reduced } = useReveal<HTMLSpanElement>(0.1);
  let i = 0;
  return (
    <span ref={ref} className={`block ${className}`}>
      {lines.map((words, l) => (
        <span key={l} className="flex flex-wrap gap-x-[0.24em]">
          {words.map((word) => {
            const d = delay + i++ * stagger;
            return (
              // overflow mask (padded so descenders / commas never clip)
              <span key={word} className="-my-[0.12em] inline-block overflow-hidden py-[0.12em]">
                <span
                  className="inline-block will-change-transform"
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateY(0)" : "translateY(110%)",
                    transition: reduced
                      ? "none"
                      : `transform 1000ms ${EASE} ${d}ms, opacity 700ms ease-out ${d}ms`,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
