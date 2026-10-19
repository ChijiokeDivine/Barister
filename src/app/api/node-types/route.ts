import { route } from "@/lib/api";
import { nodeCatalog } from "@/lib/agents/registry";

/** Palette for the workflow canvas: node types + JSON-Schema config so the UI can auto-render settings forms. */
export const GET = route(async () => nodeCatalog());
