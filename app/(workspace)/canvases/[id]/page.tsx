import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import CanvasWorkspace from "@/components/canvas-workspace";
import { db } from "@/lib/db";
import {
  canvasNodes,
  canvases,
  inspirationNotes,
} from "@/lib/db/schema";
import type { CanvasNodeType } from "@/lib/canvas-types";

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

      <CanvasWorkspace initialNodes={initialNodes} />
    </>
  );
}
