import Link from "next/link";
import { LuFileText, LuFolder } from "react-icons/lu";
import { Badge } from "@/components/dashboard/ui/Badge";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList, Stat } from "@/components/dashboard/ui/Panel";
import { getOutputsData } from "@/lib/server/queries";
import { relativeTime, titleCase } from "@/lib/ui/format";

export const instant = false;

const KINDS = ["trial_outline", "timeline", "risk_matrix", "report"] as const;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Deliverables library. */
export default async function OutputsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const caseId = one(sp.caseId) || undefined;
  const kind = one(sp.kind);
  const data = await getOutputsData(caseId);
  const filtered = kind && KINDS.includes(kind as (typeof KINDS)[number]) ? data.outputs.filter((o) => o.kind === kind) : data.outputs;
  const activeMatter = data.matters.find((m) => m.id === caseId);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div>
        <h1 className="font-serif text-[26px] leading-tight text-fg">Deliverables</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-fg-muted">
          {activeMatter ? `${activeMatter.number} · ${activeMatter.name}` : "Every saved output, with its integrity hash and export options."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Deliverables" value={data.outputs.length} />
        <Stat label="Outlines" value={data.outputs.filter((o) => o.kind === "trial_outline").length} />
        <Stat label="Timelines" value={data.outputs.filter((o) => o.kind === "timeline").length} />
        <Stat label="Reports" value={data.outputs.filter((o) => o.kind === "report" || o.kind === "risk_matrix").length} />
      </div>

      <form method="get" action="/outputs" className="mt-4 flex flex-wrap items-end gap-2">
        <label htmlFor="output-case" className="sr-only">
          Matter
        </label>
        <select
          id="output-case"
          name="caseId"
          defaultValue={caseId ?? ""}
          className="h-9 min-w-52 rounded-md border border-line bg-white px-3 text-[13px] text-fg outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
        >
          <option value="">All matters</option>
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.number} · {m.name}
            </option>
          ))}
        </select>
        <label htmlFor="output-kind" className="sr-only">
          Kind
        </label>
        <select
          id="output-kind"
          name="kind"
          defaultValue={kind ?? ""}
          className="h-9 rounded-md border border-line bg-white px-3 text-[13px] text-fg outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {titleCase(k)}
            </option>
          ))}
        </select>
        <button type="submit" className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-[12.5px] font-medium text-fg transition hover:bg-surface">
          Apply
        </button>
        {(caseId || kind) && (
          <Link href="/outputs" className="inline-flex h-9 items-center px-1 text-[12.5px] text-fg-muted transition hover:text-fg">
            Clear
          </Link>
        )}
      </form>

      <Panel className="mt-5" title="Library" bodyClassName="p-2">
        {filtered.length ? (
          <RowList>
            {filtered.map((o) => {
              const matter = data.matters.find((m) => m.id === o.caseId);
              return (
                <RowItem key={o.id}>
                  <DataRow
                    href={`/outputs/${o.id}`}
                    icon={<LuFileText />}
                    title={o.title}
                    meta={`${matter ? `${matter.number} · ` : "No matter · "}${relativeTime(o.createdAt)} · ${o.hash.slice(0, 10)}…`}
                    right={<Badge tone="neutral">{titleCase(o.kind)}</Badge>}
                  />
                </RowItem>
              );
            })}
          </RowList>
        ) : (
          <EmptyState icon={<LuFolder />} title="No deliverables" description="Run a workflow with a Deliverable node to produce one." />
        )}
      </Panel>
    </div>
  );
}
