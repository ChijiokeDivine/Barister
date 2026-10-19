/** Deliverable → Markdown / Word. Pure formatting; content was already rehydrated when saved. */
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { OutputContent } from "./agents/context";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function toMarkdown(c: OutputContent): string {
  const out: string[] = [`# ${c.title}`, `_Generated ${new Date().toISOString().slice(0, 10)} · PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT_`, ""];
  for (const s of c.sections) {
    out.push(`## ${s.heading}`, "");
    if (s.body) out.push(s.body, "");
    if (s.table) {
      out.push(`| ${s.table.columns.map(esc).join(" | ")} |`, `| ${s.table.columns.map(() => "---").join(" | ")} |`);
      for (const r of s.table.rows) out.push(`| ${r.map(esc).join(" | ")} |`);
      out.push("");
    }
    for (const it of s.items ?? []) out.push(`- ${it.text}${it.meta ? `\n  _${it.meta}_` : ""}`);
    if (s.items?.length) out.push("");
  }
  return out.join("\n");
}

export async function toDocx(c: OutputContent): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: c.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: "PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT", bold: true, size: 18 })], alignment: AlignmentType.LEFT, spacing: { after: 240 } }),
  ];
  for (const s of c.sections) {
    children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1, spacing: { before: 240 } }));
    if (s.body) children.push(new Paragraph({ text: s.body, spacing: { after: 120 } }));
    if (s.table) {
      const w = Math.floor(9000 / s.table.columns.length);
      const row = (cells: string[], header = false) =>
        new TableRow({ tableHeader: header, children: cells.map((t) => new TableCell({ width: { size: w, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: header, size: 18 })] })] })) });
      children.push(new Table({ width: { size: 9000, type: WidthType.DXA }, rows: [row(s.table.columns, true), ...s.table.rows.map((r) => row(r))] }));
    }
    for (const it of s.items ?? []) {
      children.push(new Paragraph({ children: [new TextRun({ text: it.text })], bullet: { level: 0 }, spacing: { after: 40 } }));
      if (it.meta) children.push(new Paragraph({ children: [new TextRun({ text: it.meta, italics: true, size: 18, color: "555555" })], indent: { left: 720 }, spacing: { after: 100 } }));
    }
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
