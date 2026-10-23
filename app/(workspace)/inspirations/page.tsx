import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { inspirationKeywords, inspirations } from "@/lib/db/schema";
import { createInspiration } from "./actions";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  active: "active",
  merged: "已融合",
  archived: "归档",
};

const originLabels: Record<string, string> = {
  manual: "手动",
  merged: "融合",
  ai: "AI",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(value);
}

export default function InspirationsPage() {
  const rows = db
    .select()
    .from(inspirations)
    .orderBy(desc(inspirations.createdAt))
    .all();

  const keywordRows = db.select().from(inspirationKeywords).all();
  const keywordMap = new Map<string, string[]>();

  for (const row of keywordRows) {
    const list = keywordMap.get(row.inspirationId) ?? [];
    list.push(row.keyword);
    keywordMap.set(row.inspirationId, list);
  }

  const activeCount = rows.filter((row) => row.status === "active").length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">Inspiration Library</p>
          <h1 className="page-title">灵感库</h1>
          <p className="page-subtitle">
            收集链接、文字和想法。融合、关键词和发送到画布会在后续阶段接入。
          </p>
        </div>
        <div className="stat-row">
          <span className="stat">{rows.length} 条灵感</span>
          <span className="stat">{activeCount} 条 active</span>
        </div>
      </header>

      <section className="create-panel">
        <form action={createInspiration} className="create-form">
          <div className="form-field">
            <label htmlFor="title">标题</label>
            <input
              id="title"
              name="title"
              className="input"
              placeholder="例如：远程办公"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="content">内容 / 链接</label>
            <textarea
              id="content"
              name="content"
              className="textarea"
              placeholder="粘贴链接、摘录，或写下自己的想法"
              rows={2}
            />
          </div>
          <button type="submit" className="button-primary">
            添加灵感
          </button>
        </form>
      </section>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>还没有灵感。</strong>
          <span>先添加一条文字或链接，M2 会接上关键词和融合。</span>
        </div>
      ) : (
        <div className="card-grid">
          {rows.map((row) => (
            <article key={row.id} className="card inspiration-card">
              <div className="card-top">
                <span className={`status-pill status-${row.status}`}>
                  {statusLabels[row.status] ?? row.status}
                </span>
                <span className="origin-pill">
                  {originLabels[row.origin] ?? row.origin}
                </span>
              </div>
              <h2>{row.title}</h2>
              <p>{row.content || "暂无内容"}</p>
              <div className="tag-row">
                {(keywordMap.get(row.id) ?? []).map((keyword) => (
                  <span key={keyword} className="tag">
                    #{keyword}
                  </span>
                ))}
              </div>
              <div className="card-meta">
                <time>{formatDate(row.createdAt)}</time>
                {row.sourceUrl ? <span>有来源链接</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
