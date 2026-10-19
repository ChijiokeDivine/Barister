import type { NodeDef } from "./context";
import { contractReviewAgent } from "./nodes/contract";
import { customAgent } from "./nodes/custom";
import { qualityGate } from "./nodes/gate";
import { inconsistencyAgent } from "./nodes/inconsistency";
import { outputDeliverable } from "./nodes/output";
import { questionsAgent } from "./nodes/questions";
import { sourceDocuments } from "./nodes/source";
import { timelineAgent } from "./nodes/timeline";
import type { WorkflowNodeType } from "./context";
import { z } from "zod";

/** Single source of truth for node types: the engine, validator, /api/node-types and chat generator all read this. */
export const REGISTRY: Record<WorkflowNodeType, NodeDef<z.ZodType>> = {
  "source.documents": sourceDocuments as NodeDef<z.ZodType>,
  "agent.timeline": timelineAgent as NodeDef<z.ZodType>,
  "agent.inconsistency": inconsistencyAgent as NodeDef<z.ZodType>,
  "agent.questions": questionsAgent as NodeDef<z.ZodType>,
  "agent.contractReview": contractReviewAgent as NodeDef<z.ZodType>,
  "agent.custom": customAgent as NodeDef<z.ZodType>,
  "control.qualityGate": qualityGate as NodeDef<z.ZodType>,
  "output.deliverable": outputDeliverable as NodeDef<z.ZodType>,
};

/** Public catalogue for the workflow builder palette (config as JSON Schema so the UI can render forms). */
export function nodeCatalog() {
  return Object.values(REGISTRY).map((d) => {
    const { $schema: _s, ...configSchema } = z.toJSONSchema(d.configSchema) as Record<string, unknown>;
    void _s;
    return { type: d.type, label: d.label, description: d.description, produces: d.produces, needsAny: d.needsAny, isSource: !!d.isSource, configSchema };
  });
}
