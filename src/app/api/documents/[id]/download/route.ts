import { route } from "@/lib/api";
import { readOriginalFile } from "@/lib/services/documents";

/** Streams the decrypted ORIGINAL file. attachment + nosniff: never render untrusted uploads inline in our origin. */
export const GET = route<{ id: string }>(async (_r, { params }) => {
  const { doc, bytes } = await readOriginalFile(params.id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "X-Content-SHA256": doc.sha256,
    },
  });
});
