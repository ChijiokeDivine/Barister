"use client";

import { useRef, useState } from "react";
import { FiPlay } from "react-icons/fi";

/* ------------------------------------------------------------------ */
/*  VideoSection video block                                              */
/* ------------------------------------------------------------------ */

export function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setIsPlaying(true);
  };

  return (
    <section id="get-started" className="mx-auto max-w-8xl bg-[#FAFAF9] px-6 py-16 lg:px-10 lg:py-24 text-center ">
      
      <h2 className="text-3xl sm:text-5xl mb-4 text-[#0f0E0D]">
        Introducing Barister
      </h2>
      <p className="text-[#111110]/70 text-lg max-w-xl mx-auto mb-8">
        Barister is a powerful platform that connects legal agents to your documents, uncovers contradictions, and turns thousands of pages into actionable work.
      </p>
      <button className="rounded-none cursor-pointer bg-[#111110] px-6 py-3.5 text-[15px] text-white hover:bg-black transition-colors mb-12">
        Request a Demo
      </button>

      <div
        className="relative mx-auto w-full max-w-5xl rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          height: "clamp(260px, 40vw, 460px)",
          background:
            "radial-gradient(circle at 50% 40%, #E9E6DD 0%, #D9D5C8 45%, #C7C2B2 100%)",
        }}
        >
        {/* Video sits above the gradient; gradient shows through until it loads */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/8061570-hd_1920_1080_25fps.mp4"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play button + gentle scrim, fades out once playing */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity duration-500 ${
            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <button
            onClick={handlePlay}
            aria-label="Play video"
            className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#111110]/90 text-white hover:bg-black transition-colors"
          >
            <FiPlay size={22} fill="white" />
          </button>
        </div>
      </div>
    </section>
  );
}