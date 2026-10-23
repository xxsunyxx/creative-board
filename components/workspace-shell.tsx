"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceNav } from "@/components/workspace-nav";

export function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCanvas =
    pathname.startsWith("/canvases/") && pathname !== "/canvases";
  const [collapsed, setCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(isCanvas);

  useEffect(() => {
    setCollapsed(
      window.localStorage.getItem("cb-sidebar-collapsed") === "1",
    );
  }, []);

  useEffect(() => {
    setFocusMode(isCanvas);
  }, [isCanvas]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        "cb-sidebar-collapsed",
        next ? "1" : "0",
      );
      return next;
    });
  };

  return (
    <div
      className={`workspace ${isCanvas && focusMode ? "is-focus" : ""}`}
    >
      <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <Link href="/" className="sidebar-brand" title="Creative Board">
          <span className="brand-mark">CB</span>
          <span className="sidebar-brand-text">
            <strong>Creative Board</strong>
            <small>M4 · 连接与维度</small>
          </span>
        </Link>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? "展开侧栏" : "折叠侧栏"}
          aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
        >
          <span>{collapsed ? "»" : "«"}</span>
          <span className="sidebar-toggle-label">
            {collapsed ? "展开" : "折叠"}
          </span>
        </button>

        <WorkspaceNav />

        <div className="sidebar-footer">
          <Link href="/m0" className="sidebar-m0">
            M0 技术验证
          </Link>
          <span>本地 · 单用户</span>
        </div>
      </aside>

      <main className="workspace-main">{children}</main>

      {isCanvas ? (
        <button
          type="button"
          className="canvas-focus-toggle"
          onClick={() => setFocusMode((current) => !current)}
        >
          {focusMode ? "退出全屏" : "全屏"}
        </button>
      ) : null}
    </div>
  );
}
