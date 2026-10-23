import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  canvases,
  inspirationKeywords,
  inspirationNotes,
  inspirations,
} from "@/lib/db/schema";
import {
  addKeyword,
  createInspiration,
  deleteKeyword,
  generateKeywords,
  mergeInspirationsAction,
  sendToCanvas,
} from "./actions";

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
  const keywordMap = new Map<
    string,
    { id: string; keyword: string }[]
  >();

  for (const row of keywordRows) {
    const list = keywordMap.get(row.inspirationId) ?? [];
    list.push({ id: row.id, keyword: row.keyword });
    keywordMap.set(row.inspirationId, list);
  }

  const noteRows = db
    .select()
    .from(inspirationNotes)
    .orderBy(desc(inspirationNotes.createdAt))
    .all();
  const noteMap = new Map<string, typeof noteRows>();

  for (const note of noteRows) {
    const list = noteMap.get(note.inspirationId) ?? [];
    list.push(note);
    noteMap.set(note.inspirationId, list);
  }

  const canvasRows = db
    .select()
    .from(canvases)
    .orderBy(desc(canvases.updatedAt))
    .all();

  const activeRows = rows.filter((row) => row.status === "active");
  const mergedCount = rows.filter((row) => row.status === "merged").length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">Inspiration Library</p>
          <h1 className="page-title">灵感库</h1>
          <p className="page-subtitle">
            收集链接、文字和想法；生成关键词、融合两条灵感，或复制到画布。
            当前关键词由本地 mock 生成，后续接真实 AI。
          </p>
        </div>
        <div className="stat-row">
          <span className="stat">{rows.length} 条灵感</span>
          <span className="stat">{activeRows.length} 条 active</span>
          <span className="stat">{mergedCount} 条已融合</span>
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

      <section className="create-panel merge-panel">
        <div className="panel-head">
          <div>
            <h2>融合两条灵感</h2>
            <p>生成一条新灵感；原文保留并标记「已融合」。</p>
          </div>
          <span className="mock-badge">mock AI</span>
        </div>

        {activeRows.length >= 2 ? (
          <form
            action={mergeInspirationsAction}
            className="create-form merge-form"
          >
            <div className="form-field">
              <label htmlFor="firstId">灵感 A</label>
              <select
                id="firstId"
                name="firstId"
                className="input"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  选择灵感
                </option>
                {activeRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="secondId">灵感 B</label>
              <select
                id="secondId"
                name="secondId"
                className="input"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  选择灵感
                </option>
                {activeRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="button-primary">
              融合
            </button>
          </form>
        ) : (
          <p className="panel-note">至少需要两条 active 灵感才能融合。</p>
        )}
      </section>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>还没有灵感。</strong>
          <span>先添加一条文字或链接，关键词会自动生成。</span>
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

              {(noteMap.get(row.id) ?? []).length > 0 ? (
                <details className="note-history">
                  <summary>
                    备注 {noteMap.get(row.id)?.length}（同步自画布）
                  </summary>
                  <div className="note-history-list">
                    {(noteMap.get(row.id) ?? []).map((note) => (
                      <p key={note.id}>
                        <time>{formatDate(note.createdAt)}</time>
                        <span>{note.content}</span>
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}

              <div className="keyword-row">
                {(keywordMap.get(row.id) ?? []).map((keyword) => (
                  <form
                    key={keyword.id}
                    action={deleteKeyword}
                    className="tag tag-editable"
                  >
                    <input type="hidden" name="keywordId" value={keyword.id} />
                    <span>#{keyword.keyword}</span>
                    <button
                      type="submit"
                      className="tag-remove"
                      aria-label={`删除 ${keyword.keyword}`}
                    >
                      ×
                    </button>
                  </form>
                ))}
              </div>

              <div className="keyword-actions">
                <form action={addKeyword} className="inline-form">
                  <input
                    type="hidden"
                    name="inspirationId"
                    value={row.id}
                  />
                  <input
                    name="keyword"
                    className="input input-small"
                    placeholder="加关键词"
                    maxLength={20}
                  />
                  <button type="submit" className="mini-button">
                    ＋
                  </button>
                </form>
                <form action={generateKeywords}>
                  <input
                    type="hidden"
                    name="inspirationId"
                    value={row.id}
                  />
                  <button type="submit" className="mini-button">
                    生成关键词
                  </button>
                </form>
              </div>

              <div className="card-meta">
                <time>{formatDate(row.createdAt)}</time>
                {row.mergedInto ? (
                  <span>已融合进新条目</span>
                ) : (
                  <span>可发送到画布</span>
                )}
              </div>

              {canvasRows.length > 0 ? (
                <form action={sendToCanvas} className="send-row">
                  <input
                    type="hidden"
                    name="inspirationId"
                    value={row.id}
                  />
                  <select
                    name="canvasId"
                    className="input select-small"
                    defaultValue={canvasRows[0]?.id}
                  >
                    {canvasRows.map((canvas) => (
                      <option key={canvas.id} value={canvas.id}>
                        {canvas.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="mini-button">
                    发送到画布
                  </button>
                </form>
              ) : (
                <p className="panel-note">
                  还没有画布，{" "}
                  <Link href="/canvases" className="text-link">
                    先建一个 →
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
