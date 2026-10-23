import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  canvasNodes,
  canvases,
  connections,
  dimensionGroups,
  dimensionNodes,
} from "@/lib/db/schema";
import type {
  CanvasSnapshot,
  EdgeDimension,
  SnapshotEdge,
  SnapshotNode,
} from "./types";
import type { NoteRole } from "@/lib/canvas-types";

export function loadCanvasSnapshot(canvasId: string): CanvasSnapshot {
  const canvas = db
    .select()
    .from(canvases)
    .where(eq(canvases.id, canvasId))
    .get();

  if (!canvas) {
    throw new Error("画布不存在");
  }

  const nodes: SnapshotNode[] = db
    .select()
    .from(canvasNodes)
    .where(
      and(
        eq(canvasNodes.canvasId, canvasId),
        isNull(canvasNodes.deletedAt),
      ),
    )
    .all()
    .map((node) => ({
      id: node.id,
      canvasId: node.canvasId,
      role: node.type as NoteRole,
      roleLocked: node.roleLocked,
      title: node.title,
      content: node.content,
      weight: node.weight,
      color: node.color,
      note: node.note,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }));

  const edges: SnapshotEdge[] = db
    .select()
    .from(connections)
    .where(eq(connections.canvasId, canvasId))
    .all()
    .map((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
    }));

  const connectionIds = edges.map((edge) => edge.id);
  const groups =
    connectionIds.length > 0
      ? db
          .select()
          .from(dimensionGroups)
          .where(inArray(dimensionGroups.connectionId, connectionIds))
          .all()
      : [];
  const groupIds = groups.map((group) => group.id);
  const dimensions =
    groupIds.length > 0
      ? db
          .select()
          .from(dimensionNodes)
          .where(inArray(dimensionNodes.groupId, groupIds))
          .all()
      : [];

  const dimensionsByGroup = new Map<
    string,
    (typeof dimensions)[number][]
  >();
  for (const dimension of dimensions) {
    const list = dimensionsByGroup.get(dimension.groupId) ?? [];
    list.push(dimension);
    dimensionsByGroup.set(dimension.groupId, list);
  }

  const dimensionsByEdge = new Map<string, EdgeDimension[]>();
  for (const group of groups) {
    const groupDimensions = dimensionsByGroup.get(group.id) ?? [];
    const byId = new Map(groupDimensions.map((node) => [node.id, node]));
    const paths: string[] = [];

    for (const selected of groupDimensions.filter((node) => node.selected)) {
      const labels: string[] = [];
      let current: (typeof groupDimensions)[number] | undefined = selected;
      const seen = new Set<string>();

      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        labels.unshift(current.label);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }

      paths.push(labels.join(" / "));
    }

    const list = dimensionsByEdge.get(group.connectionId) ?? [];
    list.push({
      connectionId: group.connectionId,
      relationType: group.relationType,
      selectedPaths: [...new Set(paths.filter(Boolean))],
    });
    dimensionsByEdge.set(group.connectionId, list);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, SnapshotEdge[]>();
  const outgoing = new Map<string, SnapshotEdge[]>();

  for (const node of nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      continue;
    }
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }

  return {
    canvas: {
      id: canvas.id,
      name: canvas.name,
      description: canvas.description,
    },
    nodes,
    edges,
    nodeById,
    incoming,
    outgoing,
    dimensionsByEdge,
  };
}
