import Link from "next/link";
import Image from "next/image";
import Header from "./Header";
import { FadeIn, RevealWords } from "./Reveal";

// Animation hierarchy: headline first, then everything else follows.
const HEADLINE = [["Build", "workflows"], ["for complex", "legal", "work"]];

export default function Hero() {
  return (
    <section className="relative isolate flex h-[90vh] [@media(max-height:670px)_and_(max-width:767px)]:h-[110vh] md:min-h-[200svh] flex-col overflow-hidden bg-[#FAFAF9] text-[#f9f7f3] ">
      {/* Placeholder – drop your candlestick image at /public/hero-bg.png (or swap for next/image) */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/hero-bg.png')] bg-cover bg-center" />

      <Header />

      {/* Headline */}
      <div className="relative flex flex-1 flex-col items-start justify-center px-5 pb-6 pt-30 md:px-11 md:pb-0 md:pt-50">
        <h1 className="text-[33px] font-normal leading-[1.04] tracking-[-0.035em] md:text-[clamp(50px,6.2vw,80px)] text-[#0f0E0D]">
          <RevealWords lines={HEADLINE} delay={150} stagger={120} />
        </h1>
        <Image
          src="/images/acf4a0772c068016f3d3312b1bf191a0e2727114-3296x1796.webp"
          alt="Legal team analytics dashboard"
          width={3296}
          height={1796}
          className="mt-5 h-auto w-full max-w-[760px] rounded-lg shadow-lg md:mt-15 md:mb-12 md:w-[100%] md:max-w-none md:self-center"
        />
      </div>
      

      {/* Bottom bar */}
      <div className="relative border-t border-[#f9f7f3]/15 px-5 pb-7 pt-6 md:flex md:h-[90px] md:items-center md:justify-between md:px-11 md:py-0">
        <FadeIn delay={1150}>
          <p className="text-[14.5px] leading-[1.3] tracking-[-0.01em] text-[#0f0E0D]/70 md:max-w-[390px] md:text-[15px]">
              Connect legal agents to your documents, uncover contradictions, and turn thousands of pages into actionable work.
          </p>
        </FadeIn>

        <FadeIn delay={1300} className="mt-6 md:mt-0">
          <div className="flex flex-col gap-[9px] md:flex-row md:gap-[18px]">
            <Link
              href="/workflows"
              className="flex h-12 items-center justify-center border border-[#0f0E0D]/40 text-[17px] font-medium tracking-[-0.01em] transition-colors duration-300 hover:bg-white/5 md:h-[46px] md:w-[141px] text-[#0f0E0D]"
            >
              See workflows
            </Link>
            <Link
              href="/dashboard"
              className="flex h-12 items-center justify-center bg-[#0f0E0D] text-[17px] font-medium tracking-[-0.01em] transition-colors duration-300 hover:bg-[#0f0E0D]/90 md:h-[46px] md:w-[141px]"
            >
              Start building
            </Link>
          </div>
        </FadeIn>

        
      </div>
    </section>
  );
}
