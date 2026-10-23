import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .get();

  if (!document) {
    notFound();
  }

  return (
    <>
      <header className="page-head document-head">
        <div>
          <Link href="/documents" className="back-link">
            ← 返回文档
          </Link>
          <h1 className="page-title">{document.title}</h1>
          <p className="page-subtitle">
            更新于 {formatDate(document.updatedAt)}
            {document.outputNodeId ? " · 来自输出节点" : " · 种子文档"}
          </p>
        </div>
      </header>

      <article className="document-panel">
        <pre className="document-body">{document.content}</pre>
      </article>
    </>
  );
}
