import Link from "next/link";
import { FiChevronDown } from "react-icons/fi";
import Header from "./Header";
import { FadeIn, RevealWords } from "./Reveal";

// Animation hierarchy: headline first, then everything else follows.
const HEADLINE = [["Alternative", "credit"], ["access,", "simplified"]];

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-[#3b1315] text-[#f9f7f3]">
      {/* Placeholder – drop your candlestick image at /public/hero-bg.png (or swap for next/image) */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/hero-bg.png')] bg-cover bg-center" />

      <Header />

      {/* Headline */}
      <div className="relative flex flex-1 items-center px-5 pb-6 pt-24 md:items-center md:px-11 md:pb-0 md:pt-0">
        <h1 className="text-[45px] font-normal leading-[1.04] tracking-[-0.035em] md:text-[clamp(64px,7.5vw,120px)]">
          <RevealWords lines={HEADLINE} delay={150} stagger={120} />
        </h1>

        <div className="absolute right-[42px] top-1/2 hidden -translate-y-1/2 lg:block">
          <FadeIn delay={1100} y={0}>
            <span className="text-[14px] tracking-[0.01em] text-[#f9f7f3]/30 [writing-mode:vertical-rl]">
              A RedBird Company
            </span>
          </FadeIn>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-[#f9f7f3]/15 px-5 pb-7 pt-6 md:flex md:h-[90px] md:items-center md:justify-between md:px-11 md:py-0">
        <FadeIn delay={1150}>
          <p className="text-[14.5px] leading-[1.3] tracking-[-0.01em] text-[#f9f7f3]/70 md:max-w-[390px] md:text-[15px]">
            Reckoner Capital delivers disciplined credit strategies to meet the unique objectives of today’s investors
          </p>
        </FadeIn>

        <FadeIn delay={1300} className="mt-6 md:mt-0">
          <div className="flex flex-col gap-[9px] md:flex-row md:gap-[18px]">
            <Link
              href="#"
              className="flex h-12 items-center justify-center border border-[#f9f7f3]/20 text-[17px] font-medium tracking-[-0.01em] transition-colors duration-300 hover:bg-white/5 md:h-[46px] md:w-[141px]"
            >
              Our ETFs
            </Link>
            <Link
              href="#"
              className="flex h-12 items-center justify-center bg-[#4a2a2c] text-[17px] font-medium tracking-[-0.01em] transition-colors duration-300 hover:bg-[#5c3739] md:h-[46px] md:w-[141px]"
            >
              Our Strategies
            </Link>
          </div>
        </FadeIn>

        <div className="mt-7 flex justify-center md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2">
          <FadeIn delay={1450} y={0}>
            <Link href="#next" aria-label="Scroll down" className="flex flex-col items-center">
              {[0, 1, 2].map((i) => (
                <FiChevronDown key={i} size={20} strokeWidth={1.4} className="-my-[6.5px]" />
              ))}
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}