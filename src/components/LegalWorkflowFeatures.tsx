
"use client";

import { useState } from "react";
import {
  FiSearch,
  FiMessageSquare,
  FiGitBranch,
  FiShare2,
  FiArrowRight,
  FiFileText,
  FiClock,
  FiCheckCircle,
} from "react-icons/fi";

const features = [
  {
    id: "analyze",
    label: "Analyze",
    title: "Find the facts across every document",
    description:
      "Search discovery files, contracts, and witness transcripts to surface relevant evidence without reviewing every page manually.",
    action: "Explore document analysis",
    icon: FiSearch,
    color: "bg-blue-100 text-blue-700",
    panel: "bg-blue-50",
    image: "/legal-analysis.png",
    imageAlt: "Legal documents being reviewed",
    prompt: "Find every reference to the disputed agreement",
    result: "Relevant passages across 2,481 pages",
    detail: "Evidence found",
  },
  {
    id: "agents",
    label: "Ask agents",
    title: "Put legal agents to work on your case",
    description:
      "Upload your documents, describe the task in plain language, and work directly with agents that help research, analyze, and draft.",
    action: "Explore legal agents",
    icon: FiMessageSquare,
    color: "bg-purple-100 text-purple-700",
    panel: "bg-purple-50",
    image: "/legal-agents.png",
    imageAlt: "Legal team working through case documents",
    prompt: "Identify inconsistencies in these witness statements",
    result: "12 potential contradictions identified",
    detail: "Agent findings",
  },
  {
    id: "workflows",
    label: "Build workflows",
    title: "Turn complex legal tasks into workflows",
    description:
      "Connect specialized agents into repeatable pipelines that review evidence, build timelines, cross-reference statements, and prepare drafts.",
    action: "Explore workflow builder",
    icon: FiGitBranch,
    color: "bg-lime-100 text-lime-800",
    panel: "bg-lime-50",
    image: "/legal-workflows.png",
    imageAlt: "Legal workflow with connected stages",
    prompt: "Prepare deposition questions from this discovery",
    result: "Timeline → Contradictions → Questions",
    detail: "Workflow pipeline",
  },
  {
    id: "outputs",
    label: "Share findings",
    title: "Turn your analysis into actionable work",
    description:
      "Organize findings, trace conclusions back to source documents, and produce structured outputs your legal team can review and refine.",
    action: "Explore legal outputs",
    icon: FiShare2,
    color: "bg-orange-100 text-orange-700",
    panel: "bg-orange-50",
    image: "/legal-findings.png",
    imageAlt: "Organized legal findings and source documents",
    prompt: "Show the evidence supporting this contradiction",
    result: "Source passages ready for review",
    detail: "Traceable evidence",
  },
];

export default function LegalWorkflowFeatures() {
  const [activeId, setActiveId] = useState("analyze");

  const active = features.find((feature) => feature.id === activeId) ?? features[0]!;

  const Icon = active.icon;

  return (
    <section id="platform" className="w-full overflow-hidden bg-[#f7f6f3] px-4 py-16 text-[#191919] sm:px-6 md:px-11 md:py-[170px] ">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-8 text-center md:mb-8">
          <h2 className="mx-auto max-w-2xl text-3xl  leading-[1.08] tracking-[-0.045em] sm:text-4xl md:text-5xl">
            From legal evidence to actionable work
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#6d6965] sm:text-base">
            Analyze documents, collaborate with legal agents, and build
            workflows for complex legal tasks.
          </p>
        </div>

        <div
          className="mb-5 flex items-center justify-center gap-2 overflow-x-auto pb-2 md:mb-7 md:gap-2.5 md:pb-0"
          role="tablist"
          aria-label="Legal workflow capabilities"
        >
          {features.map((feature) => {
            const TabIcon = feature.icon;
            const selected = activeId === feature.id;

            return (
              <button
                key={feature.id}
                id={`tab-${feature.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="legal-feature-panel"
                onClick={() => setActiveId(feature.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-none px-4 py-2.5 text-xs font-medium transition-all duration-200 sm:px-5 sm:text-sm ${
                  selected
                    ? `${feature.color}`
                    : "bg-[#eeece8] text-[#77716c] hover:bg-[#e6e3de]"
                }`}
              >
                <TabIcon size={14} />
                {feature.label}
              </button>
            );
          })}
        </div>

        <div
          id="legal-feature-panel"
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          className={`grid overflow-hidden rounded-md border border-black/[0.06] ${active.panel} md:min-h-[450px] md:grid-cols-2 md:rounded-lg`}
        >
          <div className="flex flex-col justify-center px-5 pb-7 pt-7 sm:px-8 md:px-10 md:py-12 lg:px-12">
            <div
              className={`mb-4 flex h-8 w-fit items-center gap-2 rounded-md px-3 text-xs font-medium ${active.color}`}
            >
              <Icon size={14} />
              {active.label}
            </div>

            <h3 className="max-w-lg text-[29px]  leading-[1.08] tracking-[-0.045em] sm:text-3xl lg:text-[40px]">
              {active.title}
            </h3>

            <p className="mt-4 max-w-md text-sm leading-6 text-[#4e4b49] sm:text-base sm:leading-7">
              {active.description}
            </p>

            <a
              href="#get-started"
              className="mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-3 rounded-none bg-[#33312C] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#33312C]/90"
            >
              {active.action}
              <FiArrowRight size={15} />
            </a>
          </div>

          <div className="px-3 pb-3 sm:px-5 sm:pb-5 md:py-3 md:pr-3 md:pl-0">
            <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-md border border-black/[0.04] bg-white p-4 sm:min-h-[340px] sm:p-6 md:h-full md:min-h-[420px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[#77716c]">
                  <FiFileText size={15} />
                  Legal workspace
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-medium text-green-700">
                  <FiCheckCircle size={12} />
                  Ready to review
                </div>
              </div>

              <div className="my-7 flex flex-1 flex-col justify-center">
                <div className="rounded-lg border border-[#e9e7e3] bg-[#faf9f7] p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs text-[#77716c]">
                    <Icon size={14} />
                    {active.detail}
                  </div>
                  <p className="text-sm  leading-6 text-[#242321] sm:text-base">
                    {active.prompt}
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-white p-3 text-xs leading-5 text-[#57534f]">
                    <FiSearch className="shrink-0 text-[#1769f5]" size={15} />
                    {active.result}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-md border border-[#e9e7e3] bg-white px-4 py-3 text-xs text-[#77716c]">
                  <FiClock size={14} className="shrink-0" />
                  Source-linked results for your team to verify
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#e9e7e3] pt-4">
                <span className="text-xs text-[#77716c]">
                  {active.label}
                </span>
                <span className="text-xs font-medium text-[#1769f5]">
                  Legal agent workspace
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
