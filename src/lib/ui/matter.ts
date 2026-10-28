import type { Case } from "@/lib/services/cases";
import type { Matter, Space, SpaceColor } from "@/components/dashboard/types";

const TONES: Matter["tone"][] = ["plum", "teal", "ink"];
const COLORS: SpaceColor[] = ["teal", "slate", "violet"];

/** Stable hash so a matter keeps the same tile colour in every list and sidebar. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export const toneFor = (id: string) => TONES[hash(id) % TONES.length]!;
export const spaceColorFor = (id: string) => COLORS[hash(id) % COLORS.length]!;

export function matterNumber(c: Pick<Case, "id" | "matterNumber">): string {
  const raw = c.matterNumber?.trim();
  if (raw) return raw.startsWith("#") ? raw : `#${raw}`;
  return `#${c.id.replace(/^case_/, "").slice(-8).toUpperCase()}`;
}

export function toMatter(c: Case): Matter {
  return {
    id: c.id,
    number: matterNumber(c),
    name: c.name,
    initial: (c.name.trim()[0] ?? "M").toUpperCase(),
    tone: toneFor(c.id),
  };
}

export function toSpace(c: Case): Space {
  return { id: c.id, name: c.name, color: spaceColorFor(c.id), href: `/cases/${c.id}` };
}

export function caseTitle(c: Pick<Case, "name" | "clientName">): string {
  const client = c.clientName?.trim();
  if (!client || c.name.toLowerCase().includes(client.toLowerCase())) return c.name;
  return `${c.name} | ${client}`;
}
