"use server";

import { count, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  canvasNodes,
  connections,
  inspirationNotes,
} from "@/lib/db/schema";

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
