"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter, ModelOption } from "../types";
import { LauncherComposer, type LauncherPayload } from "./ChatComposer";
import { QuickSources } from "./QuickSources";
import { DEFAULT_SOURCES, QUICK_SOURCES } from "./sources";

interface HomeLauncherProps {
  matters: Matter[];
  models: readonly ModelOption[];
}

/** Home composer + source chips; both feed the new-chat route. */
export function HomeLauncher({ matters, models }: HomeLauncherProps) {
  const router = useRouter();
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);

  const submit = ({ text, matterId, tier }: LauncherPayload) => {
    const params = new URLSearchParams({ q: text, tier });
    if (matterId) params.set("matter", matterId);
    if (sources.length) params.set("sources", sources.join(","));
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <div className="w-full">
      <LauncherComposer matters={matters} models={models} onSubmit={submit} />
      <QuickSources
        sources={QUICK_SOURCES}
        selected={sources}
        onToggle={(id) => setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))}
        className="mt-3"
      />
    </div>
  );
}
