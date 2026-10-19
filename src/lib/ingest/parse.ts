/**
 * Turns uploaded bytes into plain text — entirely in Node/TypeScript (no Python/OCR services allowed).
 * Page boundaries are written into the text as "[[PAGE n]]" markers so downstream agents can cite pages.
 */
import { ApiError } from "../errors";

export interface ParsedDocument {
  text: string;
  pages: number | null;
  kind: "pdf" | "docx" | "text";
}

export const PAGE_MARKER = (n: number) => `[[PAGE ${n}]]`;

const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";
const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b; // "PK" — .docx is a zip

function tidy(s: string): string {
  return s
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function parseDocument(buf: Buffer, filename: string): Promise<ParsedDocument> {
  const lower = filename.toLowerCase();

  // Sniff magic bytes first: extensions lie, and a mislabelled PDF would otherwise be decoded as garbage text.
  if (isPdf(buf) || lower.endsWith(".pdf")) {
    // Lazy import keeps pdf.js out of cold starts for routes that never parse PDFs.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const body = pages.map((t, i) => `${PAGE_MARKER(i + 1)}\n${t.trim()}`).join("\n\n");
    // No text layer = scanned image PDF. OCR would mean sending raw pages to a cloud model BEFORE redaction,
    // which breaks the privacy guarantee, so we refuse explicitly instead of returning an empty document.
    if (pages.join("").replace(/\s/g, "").length < 20) {
      throw new ApiError(422, "no_text_layer", "This PDF has no extractable text (likely a scan). OCR it locally first, then re-upload.");
    }
    return { text: tidy(body), pages: totalPages, kind: "pdf" };
  }

  if ((isZip(buf) && lower.endsWith(".docx")) || lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    if (!value.trim()) throw new ApiError(422, "empty_document", "The Word document contains no text");
    return { text: tidy(value), pages: null, kind: "docx" };
  }

  if (/\.(txt|md|csv|json|log|rtf|html?)$/.test(lower) || !isZip(buf)) {
    const text = buf.toString("utf8");
    // Heuristic binary check: many replacement chars means this isn't text.
    if ((text.match(/�/g)?.length ?? 0) > text.length * 0.02 + 5) {
      throw new ApiError(415, "unsupported_type", "Unsupported file type. Upload PDF, DOCX, or plain text.");
    }
    if (!text.trim()) throw new ApiError(422, "empty_document", "The file is empty");
    return { text: tidy(text), pages: null, kind: "text" };
  }

  throw new ApiError(415, "unsupported_type", "Unsupported file type. Upload PDF, DOCX, or plain text.");
}
