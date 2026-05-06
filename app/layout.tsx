import type { Metadata } from "next";
import { Manrope, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const headingFont = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Vercel 网点管理台",
  description: "基于 Next.js API Routes 与 Postgres 的网点管理后台示例。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
