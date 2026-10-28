import Link from "next/link";
import { notFound } from "next/navigation";
import { LuArrowLeft, LuExternalLink, LuFileText, LuShieldCheck } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { Panel, Stat } from "@/components/dashboard/ui/Panel";
import { DocumentActions } from "@/components/dashboard/vault/DocumentActions";
import { DocumentViewer } from "@/components/dashboard/vault/DocumentViewer";
import { getDocumentPage } from "@/lib/server/queries";
import { readText } from "@/lib/services/documents";
import { formatBytes, formatDate, titleCase } from "@/lib/ui/format";
import { anchorTone } from "@/lib/ui/status";

export const instant = false;

const PAGE = 50_000;

export default async function VaultDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getDocumentPage(id);
  if (!page) notFound();
  const { doc, matter, anchor } = page;
  const initial = await readText(id, "redacted", 0, PAGE).catch(() => null);
  const redactions = Object.values(doc.stats).reduce((a, b) => a + (b ?? 0), 0);
  const stats = Object.entries(doc.stats)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="relative shrink-0 bg-sage px-4 pb-4 pt-4 sm:px-6 lg:px-10 lg:pb-5 lg:pt-7">
        <div className="mx-auto flex w-full max-w-[1120px] items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link
              href={matter ? `/vault?caseId=${matter.id}` : "/vault"}
              aria-label="Back to vault"
              className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[15px] text-fg-muted outline-none transition-colors hover:bg-white/60 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuArrowLeft aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-3.5 shrink-0 rounded-[4px] bg-tile-teal" />
                <h1 className="min-w-0 truncate font-serif text-[20px] leading-tight text-fg sm:text-[22px] lg:text-[26px]">{doc.name}</h1>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-muted">
                {matter ? (
                  <Link href={`/cases/${matter.id}`} className="inline-flex items-center gap-1 hover:text-accent">
                    {matter.number} · {matter.name}
                  </Link>
                ) : (
                  <span>Unassigned</span>
                )}
                <span aria-hidden>·</span>
                <span>{doc.kind.toUpperCase()}</span>
                <span aria-hidden>·</span>
                <span>{formatDate(doc.createdAt)}</span>
              </p>
            </div>
          </div>
          <Badge tone={anchor ? (anchorTone[anchor.status] ?? "neutral") : "neutral"} className="mt-1 shrink-0">
            <LuShieldCheck aria-hidden className="size-3" /> {anchor ? titleCase(anchor.status) : "Not anchored"}
          </Badge>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:px-10 lg:py-6">
        <div className="min-w-0 space-y-5">
          <DocumentViewer
            id={doc.id}
            initialText={initial?.text ?? ""}
            initialTotal={initial?.total ?? 0}
            initialHasMore={initial?.hasMore ?? false}
          />

          <Panel title="Redaction summary" description={`${redactions} entities masked in this document.`}>
            {stats.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {stats.map(([type, count]) => (
                  <li key={type}>
                    <Badge tone="neutral">
                      {titleCase(type)} <span className="text-fg-subtle">×{count}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-muted">No entity types were detected in this document.</p>
            )}
            <p className="mt-3 text-[11.5px] leading-5 text-fg-subtle">
              The redacted view is exactly what the agent engine receives. Originals are encrypted at rest and only decrypted for download.
            </p>
          </Panel>
        </div>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Pages" value={doc.pages ?? "—"} />
            <Stat label="Size" value={formatBytes(doc.size)} />
            <Stat label="Chars" value={doc.charCount.toLocaleString()} />
            <Stat label="Redactions" value={redactions.toLocaleString()} />
          </div>

          <Panel title="Proof & actions" description="Hashes are recomputed from stored bytes, then checked on-chain.">
            <div className="space-y-2 text-[11.5px] leading-5 text-fg-muted">
              <p className="break-all">
                <span className="font-medium text-fg">SHA-256</span>
                <br />
                {doc.sha256}
              </p>
              <p className="break-all">
                <span className="font-medium text-fg">Redacted SHA-256</span>
                <br />
                {doc.redactedSha256}
              </p>
              {anchor && (
                <p>
                  <span className="font-medium text-fg">Anchor</span>
                  <br />
                  {anchor.txHash ? `${anchor.txHash.slice(0, 14)}…` : "Pending transaction"}
                  {anchor.blockNumber ? ` · block ${anchor.blockNumber}` : ""}
                  {anchor.explorerUrl && (
                    <Link href={anchor.explorerUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-accent hover:underline">
                      Explorer <LuExternalLink aria-hidden className="size-3" />
                    </Link>
                  )}
                </p>
              )}
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <DocumentActions id={doc.id} anchored={Boolean(doc.anchorId)} />
            </div>
          </Panel>

          <Panel title="Document">
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Uploaded</dt>
                <dd className="text-right text-fg">{formatDate(doc.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Redacted</dt>
                <dd className="text-right text-fg">{formatDate(doc.redactedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">MIME</dt>
                <dd className="max-w-[160px] truncate text-right text-fg">{doc.mime}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">ID</dt>
                <dd className="max-w-[160px] truncate text-right font-mono text-[11px] text-fg">{doc.id}</dd>
              </div>
            </dl>
            {matter && (
              <Link href={`/cases/${matter.id}?tab=vault`} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline">
                <LuFileText aria-hidden className="size-3.5" /> Open matter vault
              </Link>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
