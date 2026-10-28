/** Sources the chat can actually use in this deployment. */
export const QUICK_SOURCES = [
  { id: "vault", label: "Vault", available: true, hint: "Ground answers in this matter's redacted documents" },
  { id: "playbooks", label: "Playbooks", available: true, hint: "Include the firm negotiation playbook" },
  { id: "web", label: "Web search", available: false, hint: "Web search is not configured in this deployment" },
  { id: "caselaw", label: "Case Law", available: false, hint: "Case-law search is not configured in this deployment" },
] as const;

export type SourceId = (typeof QUICK_SOURCES)[number]["id"];
export const DEFAULT_SOURCES: SourceId[] = ["vault"];
