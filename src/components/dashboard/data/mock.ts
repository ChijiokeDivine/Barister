import type {
  ActivityItem,
  Matter,
  RecentThread,
  ResourceItem,
  Space,
} from "../types";

/**
 * Placeholder data so every screen renders standalone.
 * Replace each export with a server fetch / server action when wiring the backend.
 */

export const currentUser = { name: "Maya Sterling", firstName: "Maya", initial: "M" };

export const spaces: Space[] = [
  { id: "whitestone", name: "Whitestone Lane", color: "teal", href: "/cases/0089-1979" },
  { id: "titan", name: "Project Titan | Acme Co", color: "slate", href: "/cases/0089-1287" },
  { id: "acme-ma", name: "Acme M&A", color: "violet", href: "/cases/0089-2140" },
];

export const recents: RecentThread[] = [
  { id: "r1", title: "Overview of Transaction Diligence", href: "/chat", dot: "violet" },
  { id: "r2", title: "Key Issues in Transaction Litigation", href: "/chat", dot: "blue" },
  { id: "r3", title: "Essential Points in Transaction Law", href: "/chat", dot: "amber" },
  { id: "r4", title: "Brief on EU AI Act Litigation", href: "/chat", dot: "dashed" },
  { id: "r5", title: "Risks in Transaction Disputes", href: "/chat", dot: "violet" },
  { id: "r6", title: "Challenges in Transaction Law", href: "/chat", dot: "blue" },
];

export const pinned: RecentThread[] = [
  { id: "p1", title: "Overview of Transaction Diligence", href: "/chat" },
];

export const matters: Matter[] = [
  { id: "0089-1979", number: "#0089.1979", name: "Summit BioSystems: Series D Pricing", initial: "S", tone: "plum" },
  { id: "0089-1287", number: "#0089.1287", name: "Acme Acquisition", initial: "A", tone: "teal" },
  { id: "0089-2140", number: "#0089.2140", name: "Whiteford Lane Internal Investigation", initial: "W", tone: "ink" },
];

export const activity: ActivityItem[] = [
  { id: "a1", text: "12 agents started doing work", meta: "Completed · 4m", kind: "agents" },
  { id: "a2", text: "1,200 files added", meta: "Completed · 4m", kind: "files" },
];

export const vaults: ResourceItem[] = [
  { id: "v1", title: "Diligence Room", files: 214, comments: 12, href: "/vault" },
  { id: "v2", title: "Vendor Contracts", files: 77, comments: 5, href: "/vault" },
  { id: "v3", title: "Acquisition Agreements", files: 361, comments: 28, href: "/vault" },
];

export const library: ResourceItem[] = [
  { id: "l1", title: "Draft a Client Alert", files: 98, comments: 19, href: "/workflows" },
  { id: "l2", title: "Analyze Escrow Agreement", files: 37, comments: 3, href: "/workflows" },
  { id: "l3", title: "Analyze Term Sheet Markup", files: 36, comments: 8, href: "/workflows" },
];

export const quickSources = [
  { id: "vault", label: "Vault" },
  { id: "web", label: "Web search" },
  { id: "playbooks", label: "Playbooks" },
  { id: "caselaw", label: "Case Law" },
] as const;

export const models = ["Gemini Flash", "Groq Llama"] as const;
