"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiPlay } from "react-icons/fi";

/* -------------------------------------------------------------------------- */
/*  CONFIG — edit these                                                       */
/* -------------------------------------------------------------------------- */


type Story = {
  id: string;
  stat: string; // big number on the media tile
  statLabel: string; // small caption under the number
  quote: string;
  name: string;
  role: string; // "Title @ Firm"
  href: string; // "Read the story" destination
  // Optional: drop real assets in /public and reference them here.
  image?: string; // poster/thumbnail shown behind the play button
  videoSrc?: string; // if set, clicking play swaps the tile for this video
  // Tailwind gradient used when there's no image yet.
  gradient: string;
};

// NOTE: these are SAMPLE stories written for layout purposes.
// Replace names, firms, quotes and numbers with real customer data before shipping.
const STORIES: Story[] = [
  {
    id: "deposition-prep",
    stat: "375+",
    statLabel: "hours saved weekly",
    quote:
      "Deposition prep used to eat our paralegals for days. Now the agents draft the question outlines from discovery overnight and we just review.",
    name: "Dana Whitfield",
    role: "Litigation Partner @ Whitfield & Cross",
    href: "/case-studies/deposition-prep",
    gradient: "from-zinc-600 via-zinc-800 to-zinc-950",
  },
  {
    id: "discovery-review",
    stat: "10x",
    statLabel: "faster discovery review",
    quote:
      "We dropped a 40,000-page production into a workflow and had a cited issue map by lunch. That used to be a two-week project.",
    name: "Marcus Bello",
    role: "Senior Associate @ Bello Harmon LLP",
    href: "/case-studies/discovery-review",
    gradient: "from-stone-600 via-stone-800 to-neutral-950",
  },
  {
    id: "privacy-first",
    stat: "100%",
    statLabel: "PII redacted before the cloud",
    quote:
      "Our clients' data never leaves unredacted. That was the deciding factor for our general counsel, and the proof is right there in the logs.",
    name: "Priya Raman",
    role: "General Counsel @ Northgate Legal Group",
    href: "/case-studies/privacy-first",
    gradient: "from-slate-600 via-slate-800 to-zinc-950",
  },
  {
    id: "audit-trail",
    stat: "0",
    statLabel: "unexplained agent steps",
    quote:
      "Every agent action is hashed and anchored, so when opposing counsel asks how we got there, we can show exactly how, step by step.",
    name: "Tomás Okafor",
    role: "Managing Partner @ Okafor & Lind",
    href: "/case-studies/audit-trail",
    gradient: "from-neutral-600 via-neutral-800 to-black",
  },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function LegalCaseStudies() {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Work out which card is closest to the center of the track.
  const syncActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    syncActive();
    window.addEventListener("resize", syncActive);
    return () => window.removeEventListener("resize", syncActive);
  }, [syncActive]);

  // Stop any playing video once the user moves to another card.
  useEffect(() => {
    setPlayingId((current) =>
      current && STORIES[active]?.id !== current ? null : current
    );
  }, [active]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const card = cardRefs.current[index];
    if (!track || !card) return;
    const clamped = Math.max(0, Math.min(STORIES.length - 1, index));
    const target = cardRefs.current[clamped] ?? card;
    track.scrollTo({
      left: target.offsetLeft - (track.clientWidth - target.clientWidth) / 2,
      behavior: "smooth",
    });
  };

  return (
    <section id="stories" className="w-full bg-black py-16 text-white md:py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2 className="max-w-[14ch] text-[2rem]  leading-[1.1] tracking-tight md:max-w-none md:text-5xl">
          Legal teams that move faster 
        </h2>
      </div>

      {/* Track — scroll-snap carousel. Neighbouring cards peek in on both sides. */}
      <div
        ref={trackRef}
        onScroll={syncActive}
        className="relative mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[6%] py-2 [scrollbar-width:none] md:mt-12 md:px-[9%] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Customer stories"
      >
        {STORIES.map((story, i) => {
          const isActive = i === active;
          const isPlaying = playingId === story.id && !!story.videoSrc;

          return (
            <article
              key={story.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${STORIES.length}`}
              onClick={() => !isActive && goTo(i)}
              className={`flex w-[88%] shrink-0 snap-center flex-col gap-5 rounded-none border border-white/5 bg-[#262626] p-3 transition-opacity duration-300 md:w-[90%] md:flex-row md:gap-6 md:p-4 ${
                isActive ? "opacity-100" : "cursor-pointer opacity-40"
              }`}
            >
              {/* Media tile */}
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-none md:aspect-auto md:min-h-[380px] md:w-[58%]">
                {isPlaying ? (
                  <video
                    src={story.videoSrc}
                    controls
                    autoPlay
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <>
                    {story.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${story.gradient}`}
                      />
                    )}

                    {/* Bottom fade so the stat stays readable on any image */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Play button */}
                    <button
                      type="button"
                      aria-label={`Play story: ${story.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (story.videoSrc) setPlayingId(story.id);
                      }}
                      className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-none bg-[#e6f23a]/90 text-black  backdrop-blur transition hover:scale-105 hover:bg-[#e6f23a]"
                    >
                      <FiPlay className="ml-0.5 h-5 w-5 fill-current" />
                    </button>

                    {/* Stat */}
                    <div className="absolute bottom-4 left-4 md:bottom-5 md:left-5">
                      <p className="text-4xl  leading-none tracking-tight md:text-5xl">
                        {story.stat}
                      </p>
                      <p className="mt-1 text-xs text-white/70 md:text-sm">
                        {story.statLabel}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Copy */}
              <div className="flex flex-1 flex-col px-1 pb-2 md:px-0 md:pb-0 md:pt-2">
                <blockquote className="text-[15px]  leading-snug md:text-lg">
                  &ldquo;{story.quote}&rdquo;
                </blockquote>

                <div className="mt-5">
                  <p className="text-sm ">{story.name}</p>
                  <p className="mt-0.5 text-sm text-white/50">{story.role}</p>
                </div>

                <Link
                  href={story.href}
                  tabIndex={isActive ? 0 : -1}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-6 inline-flex w-fit items-center rounded-none bg-[#e6f23a] px-4 py-2 text-sm  text-black transition hover:brightness-95"
                >
                  Read the story
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="mx-auto mt-6 flex max-w-6xl items-center justify-between px-5 md:mt-8 md:px-8">
        <Link
          href="#"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition hover:text-white/70"
        >
          View all stories
          <FiArrowRight className="h-3.5 w-3.5" />
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous story"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            className="flex h-10 w-10 items-center justify-center rounded-none bg-[#262626] text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#262626]"
          >
            <FiArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next story"
            onClick={() => goTo(active + 1)}
            disabled={active === STORIES.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-none bg-[#262626] text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#262626]"
          >
            <FiArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}