"use server";

import { and, count, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { extractKeywords } from "@/lib/ai/mock";
import { db } from "@/lib/db";
import {
  canvasNodes,
  canvases,
  connections,
  dimensionGroups,
  dimensionNodes,
  documents,
  inspirationKeywords,
  inspirationNotes,
  inspirations,
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

export async function setNodeSelectedQuestion(
  nodeId: string,
  question: string,
) {
  if (!nodeId) {
    return { ok: false };
  }

  const next = question.trim() || null;

  db.update(canvasNodes)
    .set({ selectedQuestion: next, updatedAt: new Date() })
    .where(eq(canvasNodes.id, nodeId))
    .run();

  return { ok: true, selectedQuestion: next };
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

export async function clearNodeContent(nodeId: string) {
  if (!nodeId) {
    return { ok: false };
  }

  db.update(canvasNodes)
    .set({
      title: "",
      content: "",
      result: null,
      selectedQuestion: null,
      updatedAt: new Date(),
    })
    .where(eq(canvasNodes.id, nodeId))
    .run();

  return { ok: true };
}

export async function saveNodeToInspiration(nodeId: string) {
  const node = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!node) {
    return { ok: false, error: "便签不存在" };
  }

  const content = node.content.trim();
  if (!content) {
    return { ok: false, error: "便签还没有正文" };
  }

  const title = node.title.trim() || "未命名灵感";
  const existing = db
    .select()
    .from(inspirations)
    .where(
      and(
        eq(inspirations.title, title),
        eq(inspirations.content, content),
        eq(inspirations.status, "active"),
      ),
    )
    .get();

  if (existing) {
    return {
      ok: true,
      id: existing.id,
      title: existing.title,
      existed: true,
    };
  }

  const id = crypto.randomUUID();
  const keywords = extractKeywords({ title, content });

  db.transaction((tx) => {
    tx.insert(inspirations)
      .values({
        id,
        title,
        content,
        origin: "manual",
        status: "active",
      })
      .run();

    for (const keyword of keywords) {
      tx.insert(inspirationKeywords)
        .values({
          id: crypto.randomUUID(),
          inspirationId: id,
          keyword,
        })
        .run();
    }
  });

  revalidatePath("/inspirations");

  return { ok: true, id, title, existed: false };
}

export async function exportNodeToDocument(
  nodeId: string,
): Promise<
  | { ok: true; id: string; title: string }
  | { ok: false; error: string }
> {
  const node = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!node) {
    return { ok: false, error: "便签不存在" };
  }

  const content = node.content.trim();
  if (!content) {
    return { ok: false, error: "便签还没有正文" };
  }

  const canvas = db
    .select()
    .from(canvases)
    .where(eq(canvases.id, node.canvasId))
    .get();
  const edges = db
    .select()
    .from(connections)
    .where(
      or(
        eq(connections.fromNodeId, nodeId),
        eq(connections.toNodeId, nodeId),
      ),
    )
    .all();
  const otherIds = [
    ...new Set(
      edges.map((edge) =>
        edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId,
      ),
    ),
  ];
  const otherNodes =
    otherIds.length > 0
      ? db
          .select({ id: canvasNodes.id, title: canvasNodes.title })
          .from(canvasNodes)
          .where(inArray(canvasNodes.id, otherIds))
          .all()
      : [];
  const titleById = new Map(
    otherNodes.map((other) => [other.id, other.title]),
  );
  const groups =
    edges.length > 0
      ? db
          .select()
          .from(dimensionGroups)
          .where(
            inArray(
              dimensionGroups.connectionId,
              edges.map((edge) => edge.id),
            ),
          )
          .all()
      : [];
  const dimensions =
    groups.length > 0
      ? db
          .select()
          .from(dimensionNodes)
          .where(
            inArray(
              dimensionNodes.groupId,
              groups.map((group) => group.id),
            ),
          )
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

  const groupLabel = new Map<string, string>();
  for (const group of groups) {
    const groupDimensions = dimensionsByGroup.get(group.id) ?? [];
    const selected = groupDimensions.find((dimension) => dimension.selected);
    const labels: string[] = [];
    let current = selected;
    const byId = new Map(
      groupDimensions.map((dimension) => [dimension.id, dimension]),
    );

    while (current) {
      labels.unshift(current.label);
      current = current.parentId
        ? byId.get(current.parentId)
        : undefined;
    }

    groupLabel.set(
      group.id,
      labels.length > 0
        ? `${group.relationType}：${labels.join(" / ")}`
        : group.relationType,
    );
  }

  const groupsByEdge = new Map<string, string[]>();
  for (const group of groups) {
    const list = groupsByEdge.get(group.connectionId) ?? [];
    list.push(groupLabel.get(group.id) ?? group.relationType);
    groupsByEdge.set(group.connectionId, list);
  }

  const roles: Record<NoteRole, string> = {
    inspiration: "灵感",
    process: "过程",
    result: "结果",
    blank: "空白",
  };
  const relationLines = edges.map((edge) => {
    const outgoing = edge.fromNodeId === nodeId;
    const otherId = outgoing ? edge.toNodeId : edge.fromNodeId;
    const labels = groupsByEdge.get(edge.id) ?? [];
    const suffix =
      labels.length > 0 ? `（${labels.join("、")}）` : "";
    return `- ${outgoing ? "→" : "←"} ${titleById.get(otherId) ?? "未命名节点"}${suffix}`;
  });

  const documentTitle = node.title.trim() || "画布导出";
  const lines = [
    `# ${documentTitle}`,
    "",
    `> 角色：${roles[node.type as NoteRole]} · 权重：${node.weight}`,
    "",
    content,
  ];

  if (node.note.trim()) {
    lines.push("", "## 备注", "", node.note.trim());
  }

  if (relationLines.length > 0) {
    lines.push("", "## 关系", "", ...relationLines);
  }

  lines.push(
    "",
    `> 来源：${canvas?.name ?? "画布"} · 便签「${node.title}」`,
  );

  const id = crypto.randomUUID();
  db.insert(documents)
    .values({
      id,
      outputNodeId: node.id,
      title: documentTitle,
      content: lines.join("\n"),
    })
    .run();

  revalidatePath("/documents");

  return { ok: true, id, title: documentTitle };
}
