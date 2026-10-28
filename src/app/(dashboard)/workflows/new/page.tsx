import { WorkflowBuilder } from "@/components/dashboard/workflows/WorkflowBuilder";
import { getWorkflowPage } from "@/lib/server/queries";
import { TEMPLATES } from "@/lib/services/workflows";

export const instant = false;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Blank canvas, a template, or a draft handed over by chat. */
export default async function NewWorkflowPage({ searchParams }: Props) {
  const [sp, data] = await Promise.all([searchParams, getWorkflowPage()]);
  const template = TEMPLATES.find((t) => t.id === one(sp.template));
  return (
    <WorkflowBuilder
      mode="create"
      catalog={data.catalog}
      matters={data.matters}
      draft={one(sp.draft) === "1"}
      initial={template ? { name: template.name, description: template.description, graph: template.graph } : undefined}
    />
  );
}
