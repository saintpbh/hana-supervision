import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "HANA 슈퍼비전 보고서 AI",
  description:
    "상담 슈퍼비전 보고서를 자동 생성하는 인공지능 서비스 - 심리검사 해석, 사례개념화",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
