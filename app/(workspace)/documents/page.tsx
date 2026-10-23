import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(value);
}

function excerpt(content: string) {
  return content
    .replace(/[#>*_`-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export default function DocumentsPage() {
  const rows = db
    .select()
    .from(documents)
    .orderBy(desc(documents.updatedAt))
    .all();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">Documents</p>
          <h1 className="page-title">文档</h1>
          <p className="page-subtitle">
            输出节点保存后的成稿会出现在这里。M1 先用种子文档验证读取链路。
          </p>
        </div>
        <div className="stat-row">
          <span className="stat">{rows.length} 篇文档</span>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>还没有文档。</strong>
          <span>从画布的输出节点保存后会生成文档。</span>
        </div>
      ) : (
        <div className="card-grid">
          {rows.map((row) => (
            <article key={row.id} className="card document-card">
              <div className="card-top">
                <span className="status-pill status-active">Markdown</span>
                <span className="origin-pill">
                  {row.outputNodeId ? "来自输出节点" : "种子文档"}
                </span>
              </div>
              <h2>
                <Link href={`/documents/${row.id}`}>{row.title}</Link>
              </h2>
              <p>{excerpt(row.content)}</p>
              <div className="card-meta">
                <time>{formatDate(row.updatedAt)}</time>
                <Link href={`/documents/${row.id}`} className="text-link">
                  打开 →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
