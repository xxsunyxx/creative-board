import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/" className="sidebar-brand">
          <span className="brand-mark">CB</span>
          <span>
            <strong>Creative Board</strong>
            <small>M2 · 灵感库</small>
          </span>
        </Link>

        <WorkspaceNav />

        <div className="sidebar-footer">
          <Link href="/m0" className="sidebar-m0">
            M0 技术验证
          </Link>
          <span>本地 · 单用户</span>
        </div>
      </aside>

      <main className="workspace-main">{children}</main>
    </div>
  );
}
