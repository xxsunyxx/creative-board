import type { NoteRole } from "@/lib/canvas-types";

export type InferenceProvider = "mock" | "openai" | "anthropic" | "deepseek";

export type InferenceTaskType =
  | "fill_blank_notes"
  | "generate_questions"
  | "generate_result";

export type SnapshotNode = {
  id: string;
  canvasId: string;
  role: NoteRole;
  roleLocked: boolean;
  title: string;
  content: string;
  weight: number;
  color: string;
  note: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapshotEdge = {
  id: string;
  source: string;
  target: string;
};

export type EdgeDimension = {
  connectionId: string;
  relationType: string;
  selectedPaths: string[];
};

export type CanvasSnapshot = {
  canvas: { id: string; name: string; description: string };
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
  nodeById: Map<string, SnapshotNode>;
  incoming: Map<string, SnapshotEdge[]>;
  outgoing: Map<string, SnapshotEdge[]>;
  dimensionsByEdge: Map<string, EdgeDimension[]>;
};

export type ContextNeighbor = {
  id: string;
  role: NoteRole;
  title: string;
  content: string;
  weight: number;
  edge: {
    relationTypes: string[];
    selectedPaths: string[];
  };
};

export type InferenceContext = {
  canvas: { name: string; description: string };
  hint: string;
  node: {
    id: string;
    role: NoteRole;
    title: string;
    content: string;
    weight: number;
  };
  incoming: ContextNeighbor[];
  outgoing: ContextNeighbor[];
};

export type NodePatchFields = {
  role: NoteRole;
  title: string;
  content: string;
  roleLocked: boolean;
};

export type InferencePatchDto = {
  nodeId: string;
  before: NodePatchFields;
  after: NodePatchFields;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type RunInferenceInput = {
  canvasId: string;
  hint?: string;
  provider: InferenceProvider;
  model: string;
  apiKey?: string;
};

export type RunInferenceResult = {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  patches: InferencePatchDto[];
  usage: TokenUsage;
  canvasTokens: number;
  errors: string[];
};

export const emptyUsage = (): TokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});
