import { count, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { canvasNodes, canvases } from "@/lib/db/schema";
import { createCanvas } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(value);
}

export default function CanvasesPage() {
  const rows = db
    .select()
    .from(canvases)
    .orderBy(desc(canvases.updatedAt))
    .all();

  const nodeCounts = db
    .select({ canvasId: canvasNodes.canvasId, total: count() })
    .from(canvasNodes)
    .groupBy(canvasNodes.canvasId)
    .all();

  const nodeCountMap = new Map(
    nodeCounts.map((row) => [row.canvasId, row.total]),
  );

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">Canvas Workspace</p>
          <h1 className="page-title">画布</h1>
          <p className="page-subtitle">
            每个画布是一块独立的思考空间。M3 会接入便签、连接线和维度框。
          </p>
        </div>
        <div className="stat-row">
          <span className="stat">{rows.length} 个画布</span>
          <span className="stat">
            {nodeCounts.reduce((total, row) => total + row.total, 0)} 个节点
          </span>
        </div>
      </header>

      <section className="create-panel">
        <form action={createCanvas} className="create-form create-form-canvas">
          <div className="form-field">
            <label htmlFor="name">画布名称</label>
            <input
              id="name"
              name="name"
              className="input"
              placeholder="例如：组织创新"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="description">一句话说明</label>
            <input
              id="description"
              name="description"
              className="input"
              placeholder="这块画布想探索什么？"
            />
          </div>
          <button type="submit" className="button-primary">
            新建画布
          </button>
        </form>
      </section>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>还没有画布。</strong>
          <span>新建一个画布，下一步会把灵感发送进来。</span>
        </div>
      ) : (
        <div className="card-grid">
          {rows.map((row) => (
            <article key={row.id} className="card canvas-card">
              <div className="card-top">
                <span className="status-pill status-active">画布</span>
                <span className="origin-pill">
                  {nodeCountMap.get(row.id) ?? 0} 个节点
                </span>
              </div>
              <h2>{row.name}</h2>
              <p>{row.description || "还没有说明。"}</p>
              <div className="tag-row">
                {(row.colorLegend ?? []).map((group) => (
                  <span key={group.color} className="color-tag">
                    <span
                      className="color-tag-dot"
                      style={{ background: group.color }}
                    />
                    {group.label}
                  </span>
                ))}
              </div>
              <div className="card-meta">
                <time>{formatDate(row.updatedAt)}</time>
                <span className="muted">打开画布将在 M3 接入</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
