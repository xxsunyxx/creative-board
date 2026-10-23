import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import CanvasWorkspace from "@/components/canvas-workspace";
import { db } from "@/lib/db";
import {
  canvasNodes,
  canvases,
  connections,
  dimensionGroups,
  dimensionNodes,
  inspirationNotes,
} from "@/lib/db/schema";
import type {
  CanvasNodeType,
  DimensionEdgeType,
  DimensionGroupData,
  DimensionNodeData,
} from "@/lib/canvas-types";

export const dynamic = "force-dynamic";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const canvas = db
    .select()
    .from(canvases)
    .where(eq(canvases.id, id))
    .get();

  if (!canvas) {
    notFound();
  }

  const nodes = db
    .select()
    .from(canvasNodes)
    .where(
      and(
        eq(canvasNodes.canvasId, id),
        isNull(canvasNodes.deletedAt),
      ),
    )
    .all();

  const noteCounts = db
    .select({
      stickyNoteId: inspirationNotes.stickyNoteId,
      total: count(),
    })
    .from(inspirationNotes)
    .where(isNotNull(inspirationNotes.stickyNoteId))
    .groupBy(inspirationNotes.stickyNoteId)
    .all();

  const noteCountMap = new Map(
    noteCounts.map((row) => [row.stickyNoteId, row.total]),
  );

  const initialNodes: CanvasNodeType[] = nodes
    .filter((node) => node.type === "inspiration")
    .map((node) => ({
      id: node.id,
      type: "inspiration",
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      data: {
        title: node.title,
        content: node.content,
        weight: node.weight,
        color: node.color,
        note: node.note,
        noteCount: noteCountMap.get(node.id) ?? 0,
        sourceInspirationId: node.sourceInspirationId,
      },
    }));

  const activeNodeIds = new Set(initialNodes.map((node) => node.id));
  const canvasConnections = db
    .select()
    .from(connections)
    .where(eq(connections.canvasId, id))
    .all()
    .filter(
      (connection) =>
        activeNodeIds.has(connection.fromNodeId) &&
        activeNodeIds.has(connection.toNodeId),
    );

  const connectionIds = canvasConnections.map((connection) => connection.id);
  const groups =
    connectionIds.length > 0
      ? db
          .select()
          .from(dimensionGroups)
          .where(inArray(dimensionGroups.connectionId, connectionIds))
          .orderBy(dimensionGroups.orderIndex)
          .all()
      : [];
  const groupIds = groups.map((group) => group.id);
  const dimensionRows =
    groupIds.length > 0
      ? db
          .select()
          .from(dimensionNodes)
          .where(inArray(dimensionNodes.groupId, groupIds))
          .orderBy(dimensionNodes.orderIndex)
          .all()
      : [];

  const dimensionsByGroup = new Map<string, DimensionNodeData[]>();
  for (const row of dimensionRows) {
    const list = dimensionsByGroup.get(row.groupId) ?? [];
    list.push({
      id: row.id,
      parentId: row.parentId,
      label: row.label,
      level: row.level,
      selected: row.selected,
      orderIndex: row.orderIndex,
    });
    dimensionsByGroup.set(row.groupId, list);
  }

  const groupsByConnection = new Map<string, DimensionGroupData[]>();
  for (const group of groups) {
    const list = groupsByConnection.get(group.connectionId) ?? [];
    list.push({
      id: group.id,
      relationType: group.relationType,
      orderIndex: group.orderIndex,
      nodes: dimensionsByGroup.get(group.id) ?? [],
    });
    groupsByConnection.set(group.connectionId, list);
  }

  const initialEdges: DimensionEdgeType[] = canvasConnections.map(
    (connection) => ({
      id: connection.id,
      source: connection.fromNodeId,
      target: connection.toNodeId,
      type: "dimension",
      data: {
        groups: groupsByConnection.get(connection.id) ?? [],
        sourceColor: initialNodes.find(
          (node) => node.id === connection.fromNodeId,
        )?.data.color,
        targetColor: initialNodes.find(
          (node) => node.id === connection.toNodeId,
        )?.data.color,
      },
    }),
  );

  return (
    <>
      <header className="page-head canvas-head">
        <div>
          <Link href="/canvases" className="back-link">
            ← 返回画布
          </Link>
          <h1 className="page-title">{canvas.name}</h1>
          <p className="page-subtitle">
            {canvas.description || "还没有说明。"} · {initialNodes.length}{" "}
            个便签
          </p>
        </div>
        <div className="stat-row">
          <span className="stat">拖动保存位置</span>
          <span className="stat">权重 / 颜色 / 备注 / 删除</span>
        </div>
      </header>

      <CanvasWorkspace
        canvasId={canvas.id}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </>
  );
}
