"use server";

import {
  and,
  count,
  eq,
  isNull,
} from "drizzle-orm";
import { generateDimensions } from "@/lib/ai/mock";
import { db } from "@/lib/db";
import {
  canvasNodes,
  connections,
  dimensionGroups,
  dimensionNodes,
} from "@/lib/db/schema";
import type {
  DimensionGroupData,
  DimensionNodeData,
} from "@/lib/canvas-types";

export async function createConnection(
  canvasId: string,
  fromNodeId: string,
  toNodeId: string,
) {
  if (!canvasId || !fromNodeId || !toNodeId || fromNodeId === toNodeId) {
    return null;
  }

  const from = db
    .select()
    .from(canvasNodes)
    .where(
      and(
        eq(canvasNodes.id, fromNodeId),
        eq(canvasNodes.canvasId, canvasId),
        isNull(canvasNodes.deletedAt),
      ),
    )
    .get();
  const to = db
    .select()
    .from(canvasNodes)
    .where(
      and(
        eq(canvasNodes.id, toNodeId),
        eq(canvasNodes.canvasId, canvasId),
        isNull(canvasNodes.deletedAt),
      ),
    )
    .get();

  if (!from || !to) {
    return null;
  }

  const connectionId = crypto.randomUUID();

  db.insert(connections)
    .values({
      id: connectionId,
      canvasId,
      fromNodeId,
      toNodeId,
    })
    .run();

  return { connectionId };
}

export async function createDimensionGroup(
  connectionId: string,
  relationType: string,
) {
  const connection = db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .get();

  if (!connection || !relationType.trim()) {
    return null;
  }

  const existing =
    db
      .select({ value: count() })
      .from(dimensionGroups)
      .where(eq(dimensionGroups.connectionId, connectionId))
      .get()?.value ?? 0;

  const from = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, connection.fromNodeId))
    .get();
  const to = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, connection.toNodeId))
    .get();

  const groupId = crypto.randomUUID();
  const templates = generateDimensions(
    relationType,
    from?.title ?? "A",
    to?.title ?? "B",
  );
  const nodes: DimensionNodeData[] = [];

  db.transaction((tx) => {
    tx.insert(dimensionGroups)
      .values({
        id: groupId,
        connectionId,
        relationType,
        orderIndex: existing,
      })
      .run();

    templates.forEach((main, mainIndex) => {
      const mainId = crypto.randomUUID();
      nodes.push({
        id: mainId,
        parentId: null,
        label: main.label,
        level: "main",
        selected: false,
        orderIndex: mainIndex,
      });

      tx.insert(dimensionNodes)
        .values({
          id: mainId,
          groupId,
          parentId: null,
          label: main.label,
          level: "main",
          selected: false,
          orderIndex: mainIndex,
        })
        .run();

      main.details.forEach((detail, detailIndex) => {
        const detailId = crypto.randomUUID();
        nodes.push({
          id: detailId,
          parentId: mainId,
          label: detail.label,
          level: "detail",
          selected: false,
          orderIndex: detailIndex,
        });

        tx.insert(dimensionNodes)
          .values({
            id: detailId,
            groupId,
            parentId: mainId,
            label: detail.label,
            level: "detail",
            selected: false,
            orderIndex: detailIndex,
          })
          .run();

        detail.children?.forEach((child, childIndex) => {
          const childId = crypto.randomUUID();
          nodes.push({
            id: childId,
            parentId: detailId,
            label: child,
            level: "deeper",
            selected: false,
            orderIndex: childIndex,
          });

          tx.insert(dimensionNodes)
            .values({
              id: childId,
              groupId,
              parentId: detailId,
              label: child,
              level: "deeper",
              selected: false,
              orderIndex: childIndex,
            })
            .run();
        });
      });
    });
  });

  const group: DimensionGroupData = {
    id: groupId,
    relationType,
    orderIndex: existing,
    nodes,
  };

  return { group };
}

export async function selectDimension(
  connectionId: string,
  groupId: string,
  dimensionId: string,
) {
  const group = db
    .select()
    .from(dimensionGroups)
    .where(eq(dimensionGroups.id, groupId))
    .get();
  const node = db
    .select()
    .from(dimensionNodes)
    .where(eq(dimensionNodes.id, dimensionId))
    .get();

  if (
    !group ||
    group.connectionId !== connectionId ||
    !node ||
    node.groupId !== groupId
  ) {
    return { ok: false };
  }

  db.transaction((tx) => {
    tx.update(dimensionNodes)
      .set({ selected: false })
      .where(eq(dimensionNodes.groupId, groupId))
      .run();
    tx.update(dimensionNodes)
      .set({ selected: true })
      .where(eq(dimensionNodes.id, dimensionId))
      .run();
  });

  return { ok: true };
}

export async function addDimensionNode(
  groupId: string,
  parentId: string | null,
  label: string,
) {
  const trimmed = label.trim().slice(0, 40);
  const group = db
    .select()
    .from(dimensionGroups)
    .where(eq(dimensionGroups.id, groupId))
    .get();

  if (!group || !trimmed) {
    return null;
  }

  const parent = parentId
    ? db
        .select()
        .from(dimensionNodes)
        .where(
          and(
            eq(dimensionNodes.id, parentId),
            eq(dimensionNodes.groupId, groupId),
          ),
        )
        .get()
    : null;

  if (parentId && !parent) {
    return null;
  }

  const level: "main" | "detail" | "deeper" = parent
    ? parent.level === "main"
      ? "detail"
      : "deeper"
    : "main";

  const orderIndex =
    db
      .select({ value: count() })
      .from(dimensionNodes)
      .where(
        and(
          eq(dimensionNodes.groupId, groupId),
          parentId
            ? eq(dimensionNodes.parentId, parentId)
            : isNull(dimensionNodes.parentId),
        ),
      )
      .get()?.value ?? 0;

  const nodeId = crypto.randomUUID();

  db.insert(dimensionNodes)
    .values({
      id: nodeId,
      groupId,
      parentId,
      label: trimmed,
      level,
      selected: false,
      orderIndex,
    })
    .run();

  return {
    node: {
      id: nodeId,
      parentId,
      label: trimmed,
      level,
      selected: false,
      orderIndex,
    } satisfies DimensionNodeData,
  };
}

export async function deleteDimensionGroup(
  connectionId: string,
  groupId: string,
) {
  const group = db
    .select()
    .from(dimensionGroups)
    .where(eq(dimensionGroups.id, groupId))
    .get();

  if (!group || group.connectionId !== connectionId) {
    return { ok: false };
  }

  db.delete(dimensionGroups)
    .where(eq(dimensionGroups.id, groupId))
    .run();

  return { ok: true };
}

export async function deleteConnection(connectionId: string) {
  if (!connectionId) {
    return { ok: false };
  }

  db.delete(connections)
    .where(eq(connections.id, connectionId))
    .run();

  return { ok: true };
}
