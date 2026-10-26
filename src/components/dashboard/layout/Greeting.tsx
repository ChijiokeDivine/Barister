"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface GreetingProps {
  children: ReactNode;
  size?: "lg" | "md";
  className?: string;
}

/** Centered serif display heading. */
export function Greeting({ children, size = "lg", className }: GreetingProps) {
  return (
    <h1
      className={cn(
        "text-balance break-words text-center font-serif font-normal tracking-[-0.015em] text-fg",
        size === "lg"
          ? "text-[32px] leading-[1.15] sm:text-[38px] lg:text-[44px] lg:leading-[1.1]"
          : "text-[26px] leading-[1.2] sm:text-[30px] lg:text-[32px] lg:leading-[1.15]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

function partOfDay(hour: number) {
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/**
 * "Good morning, Maya" based on the viewer's local time. The part of day is
 * resolved after mount so server and client markup never disagree.
 */
export function TimeGreeting({ name, size = "lg", className }: { name: string; size?: GreetingProps["size"]; className?: string }) {
  const [part, setPart] = useState<string | null>(null);

  useEffect(() => {
    // Resolved after mount so server and client markup never disagree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPart(partOfDay(new Date().getHours()));
  }, []);

  return (
    <Greeting size={size} className={cn("transition-opacity duration-200", part ? "opacity-100" : "opacity-0", className)}>
      {`Good ${part ?? "morning"}, ${name}`}
    </Greeting>
  );
}
