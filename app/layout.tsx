import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Board · M0",
  description: "画布技术验证：连接线 + 多维度 chip",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
