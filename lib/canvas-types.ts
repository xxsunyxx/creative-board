import type { Node } from "@xyflow/react";

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
