import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft, LuCheck, LuDownload, LuFileText, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { Panel } from "@/components/dashboard/ui/Panel";
import { DeleteOutputButton } from "@/components/dashboard/outputs/DeleteOutputButton";
import { getOutputPage } from "@/lib/server/queries";
import { formatDate, titleCase } from "@/lib/ui/format";

export const instant = false;

/** One deliverable: formatted sections, integrity proof and exports. */
export default async function OutputPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getOutputPage(id);
  if (!page) notFound();
  const { record, content, integrity, matter } = page;

  return (
    <>
      <header className="shrink-0 border-b border-line bg-canvas px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link
              href="/outputs"
              aria-label="Back to deliverables"
              className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[15px] text-fg-muted outline-none transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuArrowLeft aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate font-serif text-[21px] leading-tight text-fg sm:text-[25px]">{record.title}</h1>
                <Badge tone="neutral">{titleCase(record.kind)}</Badge>
                <Badge tone={integrity.intact ? "success" : "danger"}>
                  {integrity.intact ? <LuCheck aria-hidden className="size-3" /> : <LuTriangleAlert aria-hidden className="size-3" />}
                  {integrity.intact ? "Intact" : "Modified"}
                </Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted">
                {matter ? (
                  <Link href={`/cases/${matter.id}`} className="hover:text-accent">
                    {matter.number} · {matter.name}
                  </Link>
                ) : (
                  <span>No matter</span>
                )}
                <span aria-hidden>·</span>
                <Link href={`/runs/${record.runId}`} className="hover:text-accent">
                  Run {record.runId.slice(0, 12)}…
                </Link>
                <span aria-hidden>·</span>
                <span>{formatDate(record.createdAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { format: "docx", label: "Word" },
              { format: "md", label: "Markdown" },
              { format: "json", label: "JSON" },
            ].map((f) => (
              <a
                key={f.format}
                href={`/api/outputs/${record.id}/export?format=${f.format}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition hover:bg-surface"
              >
                <LuDownload aria-hidden className="size-3.5" /> {f.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-6">
        <article className="min-w-0 space-y-5">
          {content.sections.length ? (
            content.sections.map((section, i) => (
              <Panel key={`${section.heading}-${i}`} title={section.heading} bodyClassName="space-y-3">
                {section.body && <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg">{section.body}</p>}
                {section.table && (
                  <div className="scroll-quiet overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-line">
                          {section.table.columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-2 py-2 font-medium text-fg-muted">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-line/60 align-top">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-2 leading-5 text-fg">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {section.items && (
                  <ul className="space-y-2.5">
                    {section.items.map((item, ii) => (
                      <li key={ii} className="rounded-lg bg-surface/60 px-3 py-2">
                        <p className="whitespace-pre-wrap text-[13px] leading-6 text-fg">{item.text}</p>
                        {item.meta && <p className="mt-1 text-[11.5px] leading-5 text-fg-muted">{item.meta}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            ))
          ) : (
            <Panel>
              <p className="py-6 text-center text-[13px] text-fg-muted">This deliverable has no formatted sections.</p>
            </Panel>
          )}
        </article>

        <aside className="space-y-4">
          <Panel title="Integrity">
            <div className="flex items-start gap-2">
              <span aria-hidden className={integrity.intact ? "mt-0.5 text-emerald-600" : "mt-0.5 text-red-600"}>
                <LuShieldCheck className="size-4" />
              </span>
              <div className="min-w-0 text-[11.5px] leading-5 text-fg-muted">
                <p className="font-medium text-fg">{integrity.intact ? "Content matches its hash" : "Content no longer matches"}</p>
                <p className="mt-1 break-all">Expected: {integrity.expected.slice(0, 24)}…</p>
                <p className="break-all">Actual: {integrity.actual.slice(0, 24)}…</p>
              </div>
            </div>
          </Panel>

          <Panel title="Details">
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Kind</dt>
                <dd className="text-right text-fg">{titleCase(record.kind)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Created</dt>
                <dd className="text-right text-fg">{formatDate(record.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Sections</dt>
                <dd className="text-right text-fg">{content.sections.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">ID</dt>
                <dd className="max-w-[150px] truncate text-right font-mono text-[11px] text-fg">{record.id}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Actions">
            <div className="space-y-2">
              <Link
                href={`/runs/${record.runId}`}
                className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface"
              >
                <LuFileText aria-hidden className="size-3.5" /> Open run
              </Link>
              <DeleteOutputButton id={record.id} />
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
