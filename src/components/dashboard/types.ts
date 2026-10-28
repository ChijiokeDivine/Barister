export type SpaceColor = "teal" | "slate" | "violet";

export interface Matter {
  /** URL-safe id, e.g. "0089-1287". */
  id: string;
  /** Display number, e.g. "#0089.1287". */
  number: string;
  name: string;
  /** Single letter shown in the tile. */
  initial: string;
  tone: "plum" | "teal" | "ink";
}

export interface Space {
  id: string;
  name: string;
  color: SpaceColor;
  href: string;
}

export interface RecentThread {
  id: string;
  title: string;
  href: string;
  /** Dot colour used by the space sidebar; ignored by the workspace sidebar. */
  dot?: "violet" | "blue" | "amber" | "white" | "dashed";
}

export interface ActivityItem {
  id: string;
  text: string;
  meta: string;
  kind: "agents" | "files";
}

export interface ResourceItem {
  id: string;
  title: string;
  files: number;
  comments: number;
  href: string;
  /** Optional unit labels so the same card can show nodes/runs or files/anchors. */
  units?: { files: string; comments: string };
}

export interface ModelOption {
  value: "auto" | "long" | "fast";
  label: string;
}

export interface ShellData {
  matters: Matter[];
  spaces: Space[];
  recents: RecentThread[];
  pinned: RecentThread[];
}
