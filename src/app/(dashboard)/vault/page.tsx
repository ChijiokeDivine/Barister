import Link from "next/link";
import { LuFileText, LuFolder, LuShieldCheck } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { UploadDocuments } from "@/components/dashboard/vault/UploadDocuments";
import { env } from "@/lib/env";
import { getVaultData } from "@/lib/server/queries";
import { formatBytes, relativeTime } from "@/lib/ui/format";

export const instant = false;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Document vault: every file, its matter, redaction count and proof status. */
export default async function VaultPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = one(sp.caseId);
  const caseId = raw === "none" ? null : raw || undefined;
  const data = await getVaultData(caseId);
  const activeMatter = data.matters.find((m) => m.id === caseId);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] leading-tight text-fg">Vault</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {activeMatter ? `${activeMatter.number} · ${activeMatter.name}` : caseId === null ? "Unassigned documents" : "All matters"}
          </p>
        </div>
        <UploadDocuments matters={data.matters} caseId={caseId} maxMb={env().MAX_UPLOAD_MB} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Documents" value={data.counts.documents} />
        <Stat label="Pages" value={data.counts.pages.toLocaleString()} />
        <Stat label="Redactions" value={data.counts.redactions.toLocaleString()} />
        <Stat label="Anchored" value={data.counts.anchored} hint={`${data.counts.documents - data.counts.anchored} without proof`} />
      </div>

      <form method="get" action="/vault" className="mt-4 flex flex-wrap items-end gap-2">
        <label htmlFor="vault-case" className="sr-only">
          Filter by matter
        </label>
        <select
          id="vault-case"
          name="caseId"
          defaultValue={raw ?? ""}
          className="h-9 min-w-52 rounded-md border border-line bg-white px-3 text-[13px] text-fg outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
        >
          <option value="">All documents</option>
          <option value="none">Unassigned</option>
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.number} · {m.name}
            </option>
          ))}
        </select>
        <button type="submit" className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-[12.5px] font-medium text-fg transition hover:bg-surface">
          Apply
        </button>
        {(raw || caseId === null) && (
          <Link href="/vault" className="inline-flex h-9 items-center px-1 text-[12.5px] text-fg-muted transition hover:text-fg">
            Clear
          </Link>
        )}
      </form>

      <Panel className="mt-5" title="Documents" description="Redacted text is what agents see; originals stay encrypted." bodyClassName="p-2">
        {data.documents.length ? (
          <RowList>
            {data.documents.map((d) => {
              const redactions = Object.values(d.stats).reduce((a, b) => a + (b ?? 0), 0);
              const matter = data.matters.find((m) => m.id === d.caseId);
              return (
                <RowItem key={d.id}>
                  <DataRow
                    href={`/vault/${d.id}`}
                    icon={<LuFileText />}
                    title={d.name}
                    meta={`${matter ? `${matter.number} · ` : "Unassigned · "}${d.pages ?? "—"} pages · ${formatBytes(d.size)} · ${redactions} redactions · ${relativeTime(d.createdAt)}`}
                    right={d.anchorId ? <Badge tone="success"><LuShieldCheck aria-hidden className="size-3" /> Anchored</Badge> : <Badge tone="neutral">{d.kind.toUpperCase()}</Badge>}
                  />
                </RowItem>
              );
            })}
          </RowList>
        ) : (
          <EmptyState
            icon={<LuFolder />}
            title={caseId === null ? "No unassigned documents" : "No documents here"}
            description="Upload PDFs, contracts, transcripts or discovery. They are hashed, encrypted and redacted before any agent reads them."
          />
        )}
      </Panel>
    </div>
  );
}
