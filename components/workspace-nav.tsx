"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "spark" | "canvas" | "doc";

const items: {
  href: string;
  label: string;
  hint: string;
  icon: IconName;
}[] = [
  {
    href: "/inspirations",
    label: "灵感库",
    hint: "收集 / 融合 / 关键词",
    icon: "spark",
  },
  {
    href: "/canvases",
    label: "画布",
    hint: "连接 / 维度 / 多跳",
    icon: "canvas",
  },
  {
    href: "/documents",
    label: "文档",
    hint: "结果 / 成稿",
    icon: "doc",
  },
];

function NavIcon({ name }: { name: IconName }) {
  if (name === "spark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11Z" />
      </svg>
    );
  }

  if (name === "canvas") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="7" rx="1.4" />
        <rect x="3" y="14" width="7" height="7" rx="1.4" />
        <rect x="14" y="14" width="7" height="7" rx="1.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

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
            title={`${item.label} · ${item.hint}`}
            aria-label={item.label}
          >
            <span className="workspace-nav-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="workspace-nav-text">
              <span className="workspace-nav-label">{item.label}</span>
              <span className="workspace-nav-hint">{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
