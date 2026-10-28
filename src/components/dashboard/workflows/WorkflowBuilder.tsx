"use client";

import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel as FlowPanel,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  LuArrowLeft,
  LuBot,
  LuCheck,
  LuChevronRight,
  LuCircleAlert,
  LuFileOutput,
  LuLayers,
  LuPlay,
  LuPlus,
  LuSave,
  LuSettings2,
  LuSparkles,
  LuTrash2,
  LuWand,
} from "react-icons/lu";
import { ApiError, api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { WorkflowGraph } from "@/lib/agents/schemas";
import type { NodeCatalogItem, ValidationIssue, ValidationResult } from "@/lib/ui/types";
import type { Matter } from "../types";
import { Badge } from "../ui/Badge";
import { Button, Spinner } from "../ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/Field";

interface BuilderData extends Record<string, unknown> {
  label?: string;
  config: Record<string, unknown>;
  nodeType: NodeCatalogItem["type"];
  description?: string;
  isSource?: boolean;
  terminal?: boolean;
  invalid?: boolean;
}

type BuilderNode = Node<BuilderData, "barister">;

const nodeTypes = { barister: StepNode } satisfies NodeTypes;

const TYPE_ICON: Record<string, ReactNode> = {
  "source.documents": <LuFileOutput />,
  "agent.timeline": <LuLayers />,
  "agent.inconsistency": <LuCircleAlert />,
  "agent.questions": <LuSparkles />,
  "agent.contractReview": <LuLayers />,
  "agent.custom": <LuWand />,
  "control.qualityGate": <LuSettings2 />,
  "output.deliverable": <LuFileOutput />,
};

const GROUP: Record<string, string> = {
  "source.documents": "Input",
  "agent.timeline": "Agents",
  "agent.inconsistency": "Agents",
  "agent.questions": "Agents",
  "agent.contractReview": "Agents",
  "agent.custom": "Agents",
  "control.qualityGate": "Control",
  "output.deliverable": "Output",
};

function StepNode({ data, selected }: NodeProps<BuilderNode>) {
  return (
    <div
      className={cn(
        "relative w-[210px] rounded-lg border bg-canvas px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-colors",
        selected ? "border-accent ring-2 ring-accent/20" : "border-line",
        data.invalid && "border-red-300",
      )}
    >
      {!data.isSource && <span className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-canvas bg-fg-subtle" />}
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-[12px] text-fg-muted">
          {TYPE_ICON[data.nodeType] ?? <LuLayers />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium leading-5 text-fg">{data.label || data.nodeType}</p>
          <p className="truncate text-[10.5px] leading-4 text-fg-subtle">{data.nodeType}</p>
        </div>
      </div>
      {data.invalid && <p className="mt-1 text-[10.5px] font-medium text-red-600">Needs attention</p>}
      {!data.terminal && <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-canvas bg-accent" />}
    </div>
  );
}

function defaultConfig(def: NodeCatalogItem | undefined): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(def?.configSchema.properties ?? {})) {
    if (schema.default !== undefined) config[key] = schema.default;
  }
  return config;
}

function uniqueId(type: string, nodes: BuilderNode[]): string {
  const base = type.split(".").pop()?.replace(/[^A-Za-z0-9_]/g, "") || "step";
  if (!nodes.some((n) => n.id === base)) return base;
  let i = 2;
  while (nodes.some((n) => n.id === `${base}${i}`)) i++;
  return `${base}${i}`;
}

function toNodes(graph: WorkflowGraph, catalog: NodeCatalogItem[]): BuilderNode[] {
  const byType = new Map(catalog.map((c) => [c.type, c]));
  return graph.nodes.map((n) => {
    const def = byType.get(n.type);
    return {
      id: n.id,
      type: "barister",
      position: n.position,
      data: {
        label: n.data.label ?? def?.label ?? n.type,
        config: n.data.config ?? {},
        nodeType: n.type,
        description: def?.description,
        isSource: def?.isSource,
        terminal: n.type === "output.deliverable",
      },
    };
  });
}

function toEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id ?? `e_${e.source}_${e.target}`,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { strokeWidth: 1.5 },
  }));
}

function autoLayout(nodes: BuilderNode[], edges: Edge[]): BuilderNode[] {
  const level = new Map(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes.length; i++) {
    for (const e of edges) level.set(e.target, Math.max(level.get(e.target) ?? 0, (level.get(e.source) ?? 0) + 1));
  }
  const rows = new Map<number, number>();
  return nodes.map((n) => {
    const l = level.get(n.id) ?? 0;
    const r = rows.get(l) ?? 0;
    rows.set(l, r + 1);
    return { ...n, position: { x: 60 + l * 290, y: 50 + r * 150 } };
  });
}

const labelize = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

interface WorkflowBuilderProps {
  mode: "create" | "edit";
  workflowId?: string;
  initial?: { name: string; description: string; graph: WorkflowGraph };
  catalog: NodeCatalogItem[];
  matters: Matter[];
  draft?: boolean;
}

export function WorkflowBuilder({ mode, workflowId, initial, catalog, matters, draft }: WorkflowBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(initial ? toNodes(initial.graph, catalog) : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial ? toEdges(initial.graph) : []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mounted, setMounted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const graph = useMemo<WorkflowGraph>(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        data: { label: n.data.label, config: n.data.config },
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined })),
    }),
    [nodes, edges],
  );
  const graphKey = JSON.stringify(graph);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  useEffect(() => {
    // React Flow measures the DOM, so mount the canvas only after hydration.
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!draft || draftLoaded) return;
    setDraftLoaded(true);
    try {
      const raw = sessionStorage.getItem("barister.workflow.draft");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { name?: string; description?: string; graph?: WorkflowGraph };
      if (!parsed.graph) return;
      setName(parsed.name ?? "");
      setDescription(parsed.description ?? "");
      setNodes(toNodes(parsed.graph, catalog));
      setEdges(toEdges(parsed.graph));
    } catch {
      setError("The workflow draft in local storage could not be read.");
    }
  }, [catalog, draft, draftLoaded, setEdges, setNodes]);

  useEffect(() => {
    if (!mounted) return;
    if (!nodes.length) {
      setIssues([]);
      return;
    }
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await api<ValidationResult>("/api/workflows/validate", { method: "POST", json: { graph: graphRef.current } });
        setIssues(result.issues);
      } catch {
        /* transient validation failures should not interrupt editing */
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [graphKey, mounted, nodes.length]);

  const issueByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue.message]);
    }
    return map;
  }, [issues]);

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, invalid: issueByNode.has(n.id) } })),
    [issueByNode, nodes],
  );
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const selectedDef = selected ? catalog.find((c) => c.type === selected.data.nodeType) : undefined;

  const addNode = (def: NodeCatalogItem) => {
    const id = uniqueId(def.type, nodes);
    const node: BuilderNode = {
      id,
      type: "barister",
      position: { x: 80 + (nodes.length % 3) * 280, y: 60 + Math.floor(nodes.length / 3) * 150 },
      data: {
        label: def.label,
        config: defaultConfig(def),
        nodeType: def.type,
        description: def.description,
        isSource: def.isSource,
        terminal: def.type === "output.deliverable",
      },
    };
    setNodes((prev) => [...prev, node]);
    setSelectedId(id);
    setNotice(null);
  };

  const updateNode = (id: string, patch: Partial<BuilderData>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  };

  const updateConfig = (id: string, key: string, value: unknown) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } } : n)));
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Give the workflow a name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "edit" && workflowId) {
        await api(`/api/workflows/${workflowId}`, { method: "PUT", json: { name: name.trim(), description: description.trim(), graph } });
        setNotice("Saved.");
      } else {
        const created = await api<{ id: string }>("/api/workflows", { method: "POST", json: { name: name.trim(), description: description.trim(), graph } });
        try {
          sessionStorage.removeItem("barister.workflow.draft");
        } catch {
          /* ignore */
        }
        router.replace(`/workflows/${created.id}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the workflow.");
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    if (!nodes.length) {
      setError("Add at least one step before running.");
      return;
    }
    if (issues.length) {
      setError("Fix the validation issues first — the run would fail immediately.");
      return;
    }
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api<{ id: string }>("/api/runs", {
        method: "POST",
        json: { graph, name: name.trim() || "Ad-hoc workflow", caseId: caseId || null, instructions: instructions.trim() || undefined },
      });
      router.push(`/runs/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        setError(`${e.message}: ${(e.details as ValidationIssue[]).map((i) => i.message).join("; ")}`);
      } else {
        setError(e instanceof Error ? e.message : "Could not start the run.");
      }
    } finally {
      setRunning(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, NodeCatalogItem[]>();
    for (const item of catalog) {
      const key = GROUP[item.type] ?? "Other";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map];
  }, [catalog]);

  if (!mounted) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh">
      <header className="shrink-0 border-b border-line bg-canvas px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link
              href="/workflows"
              aria-label="Back to workflows"
              className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[15px] text-fg-muted outline-none transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <LuArrowLeft aria-hidden />
            </Link>
            <div className="min-w-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled workflow"
                aria-label="Workflow name"
                className="block w-full min-w-0 max-w-xl bg-transparent font-serif text-[21px] leading-tight text-fg outline-none placeholder:text-fg-subtle sm:text-[24px]"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
                aria-label="Workflow description"
                className="mt-0.5 block w-full min-w-0 max-w-xl bg-transparent text-[12px] text-fg-muted outline-none placeholder:text-fg-subtle"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted">
              {validating ? (
                <>
                  <Spinner className="size-3" /> Checking…
                </>
              ) : issues.length ? (
                <>
                  <LuCircleAlert aria-hidden className="size-3.5 text-amber-600" /> {issues.length} issue{issues.length === 1 ? "" : "s"}
                </>
              ) : nodes.length ? (
                <>
                  <LuCheck aria-hidden className="size-3.5 text-emerald-600" /> Valid
                </>
              ) : (
                "Empty canvas"
              )}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setNodes((prev) => autoLayout(prev, edges))}>
              Auto layout
            </Button>
            <Button variant="secondary" size="sm" onClick={save} loading={saving}>
              <LuSave aria-hidden className="size-3.5" /> Save
            </Button>
            <Button variant="primary" size="sm" onClick={run} loading={running}>
              <LuPlay aria-hidden className="size-3.5" /> Run
            </Button>
          </div>
        </div>
        {(notice || error) && (
          <p
            role={error ? "alert" : "status"}
            className={cn("mt-2 rounded-md px-2.5 py-1.5 text-[12px] leading-5", error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")}
          >
            {error ?? notice}
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_310px]">
        <aside className="order-1 border-b border-line bg-canvas lg:border-b-0 lg:border-r" aria-label="Step palette">
          <div className="scroll-quiet max-h-[210px] overflow-y-auto p-3 lg:max-h-none">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Steps</p>
            {groups.map(([group, items]) => (
              <div key={group} className="mt-3">
                <p className="text-[11px] font-medium text-fg-muted">{group}</p>
                <div className="mt-1.5 grid gap-1">
                  {items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => addNode(item)}
                      title={item.description}
                      className="group flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left outline-none transition-colors hover:border-line hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-surface text-[12px] text-fg-muted group-hover:bg-canvas">
                        {TYPE_ICON[item.type] ?? <LuLayers />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-fg">{item.label}</span>
                        <span className="block truncate text-[10.5px] text-fg-subtle">→ {item.produces}</span>
                      </span>
                      <LuPlus aria-hidden className="size-3 shrink-0 text-fg-subtle" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="order-2 min-h-[520px] bg-surface/40 p-2 sm:p-3">
          <div className="h-full min-h-[500px] overflow-hidden rounded-xl border border-line bg-canvas">
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(c: Connection) => setEdges((prev) => addEdge({ ...c, id: `e_${c.source}_${c.target}_${Date.now().toString(36)}`, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 }, style: { strokeWidth: 1.5 } }, prev))}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onNodesDelete={(deleted) => {
                setEdges((prev) => prev.filter((e) => !deleted.some((d) => d.id === e.source || d.id === e.target)));
                setSelectedId(null);
              }}
              fitView
              minZoom={0.25}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              className="[--xy-background-color:var(--color-canvas)]"
            >
              <Background gap={18} size={1} color="#e5e4e1" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-canvas" maskColor="rgb(246 245 243 / 0.7)" />
              {!nodes.length && (
                <FlowPanel position="top-center" className="!m-0 !mt-16">
                  <p className="rounded-lg border border-dashed border-line bg-canvas/95 px-4 py-3 text-center text-[12.5px] text-fg-muted shadow-card">
                    Add a step from the palette, then drag from one node to the next.
                  </p>
                </FlowPanel>
              )}
            </ReactFlow>
          </div>
        </div>

        <aside className="order-3 border-t border-line bg-canvas lg:border-l lg:border-t-0" aria-label="Inspector">
          <div className="scroll-quiet max-h-none overflow-y-auto p-3 lg:max-h-[calc(100dvh-110px)]">
            {selected && selectedDef ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Step</p>
                    <p className="truncate text-[13px] font-medium text-fg">{selectedDef.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNode(selected.id)}
                    aria-label="Delete step"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[14px] text-fg-muted outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <LuTrash2 aria-hidden />
                  </button>
                </div>
                <p className="text-[11.5px] leading-5 text-fg-muted">{selectedDef.description}</p>
                <Field label="Label">
                  <Input value={selected.data.label ?? ""} onChange={(e) => updateNode(selected.id, { label: e.target.value })} />
                </Field>
                <p className="rounded-md bg-surface px-2 py-1.5 font-mono text-[10.5px] text-fg-subtle">
                  {selected.id} · produces {selectedDef.produces}
                </p>
                {Object.entries(selectedDef.configSchema.properties ?? {}).map(([key, schema]) => (
                  <ConfigField
                    key={key}
                    name={key}
                    schema={schema}
                    value={selected.data.config[key]}
                    incoming={edges.filter((e) => e.target === selected.id).map((e) => e.source)}
                    onChange={(value) => updateConfig(selected.id, key, value)}
                  />
                ))}
                {!Object.keys(selectedDef.configSchema.properties ?? {}).length && <p className="text-[12px] text-fg-muted">This step has no options.</p>}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center">
                <p className="font-serif text-[15px] text-fg">Select a step</p>
                <p className="mt-1 text-[12px] leading-5 text-fg-muted">Click a node to edit its configuration.</p>
              </div>
            )}

            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Validation</p>
                {issues.length > 0 && <Badge tone="warn">{issues.length}</Badge>}
              </div>
              {issues.length ? (
                <ul className="mt-2 space-y-1.5">
                  {issues.slice(0, 8).map((issue, i) => (
                    <li key={`${issue.nodeId ?? "graph"}-${i}`}>
                      <button
                        type="button"
                        onClick={() => issue.nodeId && setSelectedId(issue.nodeId)}
                        className="flex w-full items-start gap-1.5 rounded-md px-1 py-1 text-left text-[11.5px] leading-5 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                      >
                        <LuChevronRight aria-hidden className="mt-0.5 size-3 shrink-0" />
                        <span>{issue.nodeId ? `${issue.nodeId}: ` : ""}{issue.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11.5px] text-fg-muted">{nodes.length ? "No structural issues found." : "Add steps to validate."}</p>
              )}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Run</p>
              <div className="mt-2 space-y-2.5">
                <Field label="Matter">
                  <Select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                    <option value="">No matter (unassigned documents)</option>
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.number} · {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Instructions" hint="Optional extra direction for this run.">
                  <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="e.g. Focus on the March board meeting." />
                </Field>
                <Button variant="primary" size="sm" className="w-full" onClick={run} loading={running}>
                  <LuPlay aria-hidden className="size-3.5" /> Run workflow
                </Button>
                <p className="text-[11px] leading-4 text-fg-subtle">The run uses a snapshot of this canvas; later edits do not affect it.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface ConfigFieldProps {
  name: string;
  schema: NonNullable<NodeCatalogItem["configSchema"]["properties"]>[string];
  value: unknown;
  incoming: string[];
  onChange: (value: unknown) => void;
}

function ConfigField({ name, schema, value, incoming, onChange }: ConfigFieldProps) {
  const label = schema.title ?? labelize(name);
  const hint = schema.description;
  if (name === "target") {
    return (
      <Field label={label} hint="The step this gate reviews.">
        <Select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose an incoming step</option>
          {incoming.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (schema.enum) {
    return (
      <Field label={label} hint={hint}>
        <Select value={String(value ?? schema.enum[0] ?? "")} onChange={(e) => onChange(e.target.value)}>
          {schema.enum.map((v) => (
            <option key={String(v)} value={String(v)}>
              {labelize(String(v))}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (schema.type === "boolean") {
    return <Checkbox label={label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <Field label={label} hint={hint}>
        <Input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          min={schema.minimum}
          max={schema.maximum}
        />
      </Field>
    );
  }
  if (schema.type === "array") {
    const text = Array.isArray(value) ? value.join("\n") : "";
    return (
      <Field label={label} hint={hint ?? "One value per line."}>
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))}
          rows={3}
          placeholder={name === "docIds" ? "Leave empty to use every document in the matter" : undefined}
        />
      </Field>
    );
  }
  if (schema.type === "object") {
    return (
      <Field label={label} hint={hint ?? "JSON object."}>
        <Textarea
          value={value ? JSON.stringify(value, null, 2) : "{}"}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              /* keep the last valid value while typing */
            }
          }}
          rows={4}
          className="font-mono text-[11.5px]"
        />
      </Field>
    );
  }
  const long = name === "instruction" || name === "focus" || name === "witness";
  return (
    <Field label={label} hint={hint}>
      {long ? (
        <Textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <Input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
