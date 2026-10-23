"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/inspirations", label: "灵感库", hint: "收集 / 融合 / 关键词" },
  { href: "/canvases", label: "画布", hint: "连接 / 维度 / 多跳" },
  { href: "/documents", label: "文档", hint: "结果 / 成稿" },
];

export function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav className="workspace-nav">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`workspace-nav-item ${active ? "is-active" : ""}`}
          >
            <span className="workspace-nav-label">{item.label}</span>
            <span className="workspace-nav-hint">{item.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
