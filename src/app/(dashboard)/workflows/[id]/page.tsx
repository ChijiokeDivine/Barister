import { notFound } from "next/navigation";
import { WorkflowBuilder } from "@/components/dashboard/workflows/WorkflowBuilder";
import { getWorkflowPage } from "@/lib/server/queries";

export const instant = false;

/** Edit an existing workflow graph, or run it from the same canvas. */
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getWorkflowPage(id);
  if (!data.workflow) notFound();
  const workflow = data.workflow;

  return (
    <WorkflowBuilder
      mode="edit"
      workflowId={workflow.id}
      catalog={data.catalog}
      matters={data.matters}
      initial={{ name: workflow.name, description: workflow.description, graph: workflow.graph }}
    />
  );
}
