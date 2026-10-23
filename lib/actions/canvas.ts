"use server";

import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inferNoteContent } from "@/lib/ai/mock";
import { db } from "@/lib/db";
import {
  canvasNodes,
  connections,
  dimensionGroups,
  inspirationNotes,
} from "@/lib/db/schema";
import type { NoteRole } from "@/lib/canvas-types";

const roleMeta: Record<
  NoteRole,
  { title: string; color: string }
> = {
  inspiration: { title: "空灵感", color: "#3b82f6" },
  process: { title: "过程", color: "#f59e0b" },
  result: { title: "空结果", color: "#10b981" },
  blank: { title: "空便签", color: "#94a3b8" },
};

export async function createNote(
  canvasId: string,
  role: NoteRole,
  x: number,
  y: number,
) {
  if (
    !canvasId ||
    !["inspiration", "process", "result", "blank"].includes(role) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  const meta = roleMeta[role];
  const id = crypto.randomUUID();
  const roleLocked = role !== "blank";

  db.insert(canvasNodes)
    .values({
      id,
      canvasId,
      type: role,
      roleLocked,
      title: meta.title,
      content: "",
      weight: 5,
      color: meta.color,
      x,
      y,
      width: 280,
      height: 200,
    })
    .run();

  return {
    id,
    role,
    title: meta.title,
    content: "",
    weight: 5,
    color: meta.color,
    note: "",
    roleLocked,
    x,
    y,
    width: 280,
    height: 200,
  };
}

export async function updateNoteRole(nodeId: string, role: NoteRole) {
  if (
    !nodeId ||
    !["inspiration", "process", "result", "blank"].includes(role)
  ) {
    return { ok: false };
  }

  const node = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!node) {
    return { ok: false };
  }

  const defaultTitles = new Set(["空灵感", "过程", "空结果", "空便签"]);
  const title = defaultTitles.has(node.title)
    ? roleMeta[role].title
    : node.title;

  db.update(canvasNodes)
    .set({
      type: role,
      title,
      roleLocked: true,
      updatedAt: new Date(),
    })
    .where(eq(canvasNodes.id, nodeId))
    .run();

  return { ok: true, title };
}

export async function updateNoteContent(nodeId: string, content: string) {
  if (!nodeId) {
    return { ok: false };
  }

  db.update(canvasNodes)
    .set({ content: content.trim(), updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();

  return { ok: true };
}

export async function inferBlankNotes(canvasId: string) {
  if (!canvasId) {
    return { updated: [] };
  }

  const nodes = db
    .select()
    .from(canvasNodes)
    .where(
      and(
        eq(canvasNodes.canvasId, canvasId),
        isNull(canvasNodes.deletedAt),
      ),
    )
    .all();
  const edges = db
    .select()
    .from(connections)
    .where(eq(connections.canvasId, canvasId))
    .all();
  const connectionIds = edges.map((edge) => edge.id);
  const groups =
    connectionIds.length > 0
      ? db
          .select()
          .from(dimensionGroups)
          .where(inArray(dimensionGroups.connectionId, connectionIds))
          .all()
      : [];

  const titleById = new Map(nodes.map((node) => [node.id, node.title]));
  const incoming = new Map<string, typeof edges>();
  const outgoing = new Map<string, typeof edges>();

  for (const edge of edges) {
    const inList = incoming.get(edge.toNodeId) ?? [];
    inList.push(edge);
    incoming.set(edge.toNodeId, inList);

    const outList = outgoing.get(edge.fromNodeId) ?? [];
    outList.push(edge);
    outgoing.set(edge.fromNodeId, outList);
  }

  const relationByConnection = new Map<string, string[]>();
  for (const group of groups) {
    const list = relationByConnection.get(group.connectionId) ?? [];
    list.push(group.relationType);
    relationByConnection.set(group.connectionId, list);
  }

  const updated: {
    id: string;
    role: NoteRole;
    content: string;
    roleLocked: boolean;
  }[] = [];

  db.transaction((tx) => {
    for (const node of nodes) {
      if (node.content.trim()) {
        continue;
      }

      const inEdges = incoming.get(node.id) ?? [];
      const outEdges = outgoing.get(node.id) ?? [];
      let role: NoteRole;

      if (node.roleLocked && node.type !== "blank") {
        role = node.type;
      } else if (inEdges.length === 0 && outEdges.length === 0) {
        role = "inspiration";
      } else if (inEdges.length === 0) {
        role = "inspiration";
      } else if (outEdges.length === 0) {
        role = "result";
      } else {
        role = "process";
      }

      const incomingTitles = inEdges
        .map((edge) => titleById.get(edge.fromNodeId) ?? "")
        .filter(Boolean);
      const outgoingTitles = outEdges
        .map((edge) => titleById.get(edge.toNodeId) ?? "")
        .filter(Boolean);
      const relationTypes = [
        ...inEdges.flatMap(
          (edge) => relationByConnection.get(edge.id) ?? [],
        ),
        ...outEdges.flatMap(
          (edge) => relationByConnection.get(edge.id) ?? [],
        ),
      ];
      const content = inferNoteContent({
        role,
        incomingTitles,
        outgoingTitles,
        relationTypes,
      });

      tx.update(canvasNodes)
        .set({
          type: role,
          content,
          updatedAt: new Date(),
        })
        .where(eq(canvasNodes.id, node.id))
        .run();

      updated.push({
        id: node.id,
        role,
        content,
        roleLocked: node.roleLocked,
      });
    }
  });

  return { updated };
}

export async function insertProcessOnConnection(connectionId: string) {
  const connection = db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .get();

  if (!connection) {
    return null;
  }

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

  if (!from || !to) {
    return null;
  }

  const processId = crypto.randomUUID();
  const firstConnectionId = crypto.randomUUID();
  const secondConnectionId = crypto.randomUUID();
  const x = (from.x + to.x) / 2;
  const y = (from.y + to.y) / 2;
  const meta = roleMeta.process;

  db.transaction((tx) => {
    tx.insert(canvasNodes)
      .values({
        id: processId,
        canvasId: connection.canvasId,
        type: "process",
        roleLocked: true,
        title: meta.title,
        content: "",
        weight: 5,
        color: meta.color,
        x,
        y,
        width: 280,
        height: 200,
      })
      .run();

    tx.insert(connections)
      .values({
        id: firstConnectionId,
        canvasId: connection.canvasId,
        fromNodeId: connection.fromNodeId,
        toNodeId: processId,
      })
      .run();

    tx.insert(connections)
      .values({
        id: secondConnectionId,
        canvasId: connection.canvasId,
        fromNodeId: processId,
        toNodeId: connection.toNodeId,
      })
      .run();

    tx.update(dimensionGroups)
      .set({ connectionId: firstConnectionId })
      .where(eq(dimensionGroups.connectionId, connectionId))
      .run();

    tx.delete(connections)
      .where(eq(connections.id, connectionId))
      .run();
  });

  return {
    processNote: {
      id: processId,
      role: "process" as const,
      title: meta.title,
      content: "",
      weight: 5,
      color: meta.color,
      note: "",
      roleLocked: true,
      x,
      y,
      width: 280,
      height: 200,
    },
    firstConnectionId,
    secondConnectionId,
  };
}

export async function updateNodePosition(
  nodeId: string,
  x: number,
  y: number,
) {
  if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  db.update(canvasNodes)
    .set({ x, y, updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();
}

export async function updateNodePositions(
  updates: { id: string; x: number; y: number }[],
) {
  if (updates.length === 0) {
    return;
  }

  const now = new Date();

  db.transaction((tx) => {
    for (const update of updates) {
      if (
        !update.id ||
        !Number.isFinite(update.x) ||
        !Number.isFinite(update.y)
      ) {
        continue;
      }

      tx.update(canvasNodes)
        .set({ x: update.x, y: update.y, updatedAt: now })
        .where(eq(canvasNodes.id, update.id))
        .run();
    }
  });
}

export async function updateNodeWeight(nodeId: string, weight: number) {
  if (!nodeId || !Number.isFinite(weight)) {
    return;
  }

  const next = Math.max(1, Math.min(9, Math.round(weight)));

  db.update(canvasNodes)
    .set({ weight: next, updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();
}

export async function updateNodeSize(
  nodeId: string,
  width: number,
  height: number,
) {
  if (
    !nodeId ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return;
  }

  const nextWidth = Math.max(180, Math.min(520, Math.round(width)));
  const nextHeight = Math.max(120, Math.min(480, Math.round(height)));

  db.update(canvasNodes)
    .set({
      width: nextWidth,
      height: nextHeight,
      updatedAt: new Date(),
    })
    .where(eq(canvasNodes.id, nodeId))
    .run();
}

export async function updateNodeColor(nodeId: string, color: string) {
  if (!nodeId || !/^#[0-9a-f]{6}$/i.test(color)) {
    return;
  }

  db.update(canvasNodes)
    .set({ color, updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();
}

export async function saveNodeNote(nodeId: string, note: string) {
  const node = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!node) {
    return { noteCount: 0 };
  }

  const trimmed = note.trim();

  db.update(canvasNodes)
    .set({ note: trimmed, updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();

  if (
    trimmed &&
    trimmed !== node.note &&
    node.sourceInspirationId
  ) {
    db.insert(inspirationNotes)
      .values({
        id: crypto.randomUUID(),
        inspirationId: node.sourceInspirationId,
        stickyNoteId: node.id,
        content: trimmed,
      })
      .run();
  }

  const noteCount =
    db
      .select({ value: count() })
      .from(inspirationNotes)
      .where(eq(inspirationNotes.stickyNoteId, nodeId))
      .get()?.value ?? 0;

  revalidatePath("/inspirations");

  return { noteCount };
}

export async function deleteCanvasNode(nodeId: string) {
  if (!nodeId) {
    return;
  }

  const now = new Date();

  db.transaction((tx) => {
    tx.update(canvasNodes)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(canvasNodes.id, nodeId))
      .run();

    tx.delete(connections)
      .where(
        or(
          eq(connections.fromNodeId, nodeId),
          eq(connections.toNodeId, nodeId),
        ),
      )
      .run();
  });

  revalidatePath("/canvases");
}
