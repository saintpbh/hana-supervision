"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function ReportResultPage() {
  const router = useRouter();
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("generatedReport");
    if (!stored) {
      router.push("/report/new");
      return;
    }
    setReport(stored);
    setLoading(false);
  }, [router]);

  function handlePrint() {
    window.print();
  }

  function handleNewReport() {
    sessionStorage.removeItem("generatedReport");
    sessionStorage.removeItem("reportFormData");
    router.push("/report/new");
  }

  function handleCopy() {
    navigator.clipboard.writeText(report).then(() => {
      alert("보고서 내용이 클립보드에 복사되었습니다.");
    });
  }

  /* ── Simple markdown to HTML ── */
  function renderMarkdown(md: string): string {
    let html = md
      // headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // horizontal rule
      .replace(/^---$/gm, '<hr />')
      // blockquote
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // unordered list
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // ordered list
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // tables
    html = html.replace(
      /^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
      (_, header: string, body: string) => {
        const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
        const rows = body.trim().split('\n').map((row: string) => {
          const tds = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
          return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    );

    // paragraphs
    html = html
      .split('\n\n')
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<table') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr')) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join('\n');

    return html;
  }

  if (loading) {
    return (
      <div className="loading-overlay" style={{ position: "relative", background: "transparent" }}>
        <div className="loading-card">
          <div className="spinner" />
          <div className="loading-title">보고서 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`report-container animate-fade-in`}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className="page-title">슈퍼비전 보고서</h1>
          <p className="page-subtitle">AI가 생성한 보고서를 검토하세요</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-ghost" onClick={handleCopy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            복사
          </button>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            인쇄
          </button>
          <button className="btn btn-primary" onClick={handleNewReport}>
            새 보고서 작성
          </button>
        </div>
      </div>

      {/* Report document */}
      <div
        ref={reportRef}
        className="report-document"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
      />

      {/* Footer actions */}
      <div className={styles.footer}>
        <span className={styles.disclaimer}>
          ⚠️ 본 보고서는 AI가 생성한 초안입니다. 반드시 전문가의 검토 후 사용하세요.
        </span>
        <button className="btn btn-primary" onClick={handleNewReport}>
          새 보고서 작성 →
        </button>
      </div>
    </div>
  );
}
