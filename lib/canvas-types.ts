import type { Edge, Node } from "@xyflow/react";

export type CanvasNodeData = {
  title: string;
  content: string;
  weight: number;
  color: string;
  note: string;
  noteCount: number;
  sourceInspirationId: string | null;
};

export type CanvasNodeType = Node<CanvasNodeData, "inspiration">;

export type DimensionNodeData = {
  id: string;
  parentId: string | null;
  label: string;
  level: "main" | "detail" | "deeper";
  selected: boolean;
  orderIndex: number;
};

export type DimensionGroupData = {
  id: string;
  relationType: string;
  orderIndex: number;
  nodes: DimensionNodeData[];
};

export type DimensionEdgeData = {
  groups: DimensionGroupData[];
  sourceColor?: string;
  targetColor?: string;
};

export type DimensionEdgeType = Edge<DimensionEdgeData, "dimension">;
