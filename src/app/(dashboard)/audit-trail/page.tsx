import Link from "next/link";
import { LuExternalLink, LuFileText, LuPlay, LuShieldCheck } from "react-icons/lu";
import { VerifyHash } from "@/components/dashboard/audit/VerifyHash";
import { Badge } from "@/components/dashboard/ui/Badge";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { getAuditData } from "@/lib/server/queries";
import { formatDate, relativeTime, titleCase } from "@/lib/ui/format";
import { anchorTone } from "@/lib/ui/status";

export const instant = false;

/** On-chain ledger: what was anchored, its transaction, and independent verification. */
export default async function AuditTrailPage() {
  const data = await getAuditData();
  const confirmed = data.anchors.filter((a) => a.status === "confirmed").length;
  const pending = data.anchors.filter((a) => a.status === "pending").length;
  const failed = data.anchors.filter((a) => a.status === "failed").length;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div>
        <h1 className="font-serif text-[26px] leading-tight text-fg">Audit trail</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-fg-muted">
          Documents and run manifests are committed to Sepolia. The chain is the source of truth; this page only indexes it for speed.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Anchors" value={data.anchors.length} />
        <Stat label="Confirmed" value={confirmed} />
        <Stat label="Pending" value={pending} />
        <Stat label="Failed" value={failed} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Anchor ledger" description="Newest first. Open the referenced record or the explorer transaction." bodyClassName="p-2">
          {data.anchors.length ? (
            <RowList>
              {data.anchors.map((a) => {
                const doc = a.kind === "document" ? data.documents.find((d) => d.id === a.refId) : null;
                const run = a.kind === "run_proof" ? data.runs.find((r) => r.id === a.refId) : null;
                const href = doc ? `/vault/${doc.id}` : run ? `/runs/${run.id}` : undefined;
                return (
                  <RowItem key={a.id}>
                    <DataRow
                      href={href}
                      icon={a.kind === "document" ? <LuFileText /> : <LuShieldCheck />}
                      title={doc?.name ?? run?.workflowName ?? titleCase(a.kind)}
                      meta={`${titleCase(a.kind)} · ${a.hash.slice(0, 16)}… · ${a.blockNumber ? `block ${a.blockNumber}` : relativeTime(a.createdAt)}`}
                      right={
                        <span className="flex items-center gap-2">
                          <Badge tone={anchorTone[a.status] ?? "neutral"}>{titleCase(a.status)}</Badge>
                          {a.explorerUrl && (
                            <Link href={a.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline">
                              Tx <LuExternalLink aria-hidden className="size-3" />
                            </Link>
                          )}
                        </span>
                      }
                    />
                  </RowItem>
                );
              })}
            </RowList>
          ) : (
            <p className="px-2 py-4 text-[13px] text-fg-muted">
              Nothing anchored yet. Anchor a document from the vault, or enable anchoring on a Deliverable node.
            </p>
          )}
        </Panel>

        <aside className="space-y-4">
          <Panel title="Verify a hash" description="Paste a digest or hash a file locally. Nothing is uploaded.">
            <VerifyHash />
          </Panel>
          <Panel title="What gets anchored">
            <ul className="space-y-2 text-[12px] leading-5 text-fg-muted">
              <li>
                <span className="font-medium text-fg">Documents</span> — the SHA-256 of the original bytes, so the vault copy can be proven unchanged.
              </li>
              <li>
                <span className="font-medium text-fg">Runs</span> — a manifest hash over the workflow, input document hashes, output hashes and models used.
              </li>
              <li>
                <span className="font-medium text-fg">Deliverables</span> — the content hash is verified locally and can be exported with the same digest.
              </li>
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[11px] text-fg-subtle">
              {data.anchors[0]?.chainId ? `Chain ${data.anchors[0].chainId} · ` : ""}
              Ledger loaded {formatDate(new Date().toISOString())}
            </p>
          </Panel>
          <Panel title="Run proofs">
            {data.runs.filter((r) => r.proofAnchorId).length ? (
              <RowList>
                {data.runs
                  .filter((r) => r.proofAnchorId)
                  .slice(0, 6)
                  .map((r) => (
                    <RowItem key={r.id}>
                      <DataRow href={`/runs/${r.id}`} icon={<LuPlay />} title={r.workflowName} meta={relativeTime(r.finishedAt ?? r.createdAt)} />
                    </RowItem>
                  ))}
              </RowList>
            ) : (
              <p className="text-[12px] text-fg-muted">No run proofs yet.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
