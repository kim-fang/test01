import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入下单系统",
  description: "支持多模板 Excel 自动识别、预览编辑、批量提交和历史运单查询的全栈示例。",
};

const fontVars: CSSProperties & Record<"--font-heading" | "--font-body", string> = {
  "--font-heading":
    'Inter, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  "--font-body":
    '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" style={fontVars}>
      <body>{children}</body>
    </html>
  );
}
