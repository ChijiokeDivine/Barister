import { LuFileText, LuFolder, LuLayers, LuMessageSquare, LuPackage, LuSearch } from "react-icons/lu";
import { EmptyState } from "@/components/dashboard/ui/EmptyState";
import { DataRow, Panel, RowItem, RowList } from "@/components/dashboard/ui/Panel";
import { searchWorkspace, type SearchHit } from "@/lib/server/queries";

export const instant = false;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Group({ title, hits, icon }: { title: string; hits: SearchHit[]; icon: React.ReactNode }) {
  if (!hits.length) return null;
  return (
    <Panel title={`${title} · ${hits.length}`} bodyClassName="p-2">
      <RowList>
        {hits.map((hit) => (
          <RowItem key={hit.id}>
            <DataRow href={hit.href} icon={icon} title={hit.title} meta={hit.meta} />
          </RowItem>
        ))}
      </RowList>
    </Panel>
  );
}

/** Server-rendered workspace search. The form works without JavaScript. */
export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = one(sp.q)?.trim() ?? "";
  const results = await searchWorkspace(query);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <h1 className="font-serif text-[26px] leading-tight text-fg">Search</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-fg-muted">
        Find matters, vault documents, workflows, deliverables and conversations. Search runs against titles and metadata only.
      </p>

      <form action="/search" method="get" role="search" className="mt-4 flex max-w-2xl items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <LuSearch aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search the workspace…"
            aria-label="Search the workspace"
            className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[13.5px] text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-md bg-fg px-4 text-[13px] font-medium text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Search
        </button>
      </form>

      {!query ? (
        <EmptyState
          className="mt-6"
          icon={<LuSearch />}
          title="Search across the firm's workspace"
          description="Try a client name, a document title, a workflow, or a phrase from a conversation title."
        />
      ) : results.total === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<LuSearch />}
          title={`No matches for “${query}”`}
          description="Check the spelling or try a broader term. Document bodies are not indexed—only their names."
        />
      ) : (
        <>
          <p className="mt-5 text-[12px] text-fg-muted">
            {results.total} result{results.total === 1 ? "" : "s"} for <span className="font-medium text-fg">“{query}”</span>
          </p>
          <div className="mt-3 space-y-4">
            <Group title="Matters" hits={results.matters} icon={<LuFolder />} />
            <Group title="Documents" hits={results.documents} icon={<LuFileText />} />
            <Group title="Workflows" hits={results.workflows} icon={<LuLayers />} />
            <Group title="Deliverables" hits={results.outputs} icon={<LuPackage />} />
            <Group title="Conversations" hits={results.conversations} icon={<LuMessageSquare />} />
          </div>
        </>
      )}
    </div>
  );
}
