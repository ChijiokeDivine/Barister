import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { toDocx, toMarkdown } from "@/lib/export";
import { getOutput } from "@/lib/services/outputs";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** ?format=docx|md|json. Content was rehydrated at save time, so exports contain the real names/dates. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { format } = parseQuery(req, z.object({ format: z.enum(["docx", "md", "json"]).default("docx") }));
  const { record, content } = await getOutput(params.id);
  const base = record.title.replace(/[^\w.-]+/g, "_").slice(0, 80) || "deliverable";
  const headers = (type: string, ext: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${base}.${ext}"`, "Cache-Control": "no-store", "X-Content-SHA256": record.hash });
  if (format === "md") return new Response(toMarkdown(content), { headers: headers("text/markdown; charset=utf-8", "md") });
  if (format === "json") return new Response(JSON.stringify(content, null, 2), { headers: headers("application/json", "json") });
  return new Response(new Uint8Array(await toDocx(content)), { headers: headers(DOCX, "docx") });
});
