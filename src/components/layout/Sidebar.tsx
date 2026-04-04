"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import styles from "./Sidebar.module.css";
import { getAllReports, createNewReport, type SavedReport } from "@/lib/reportStorage";

const navItems = [
  {
    label: "대시보드",
    href: "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "음성 축어록 변환",
    href: "/transcript",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" x2="12" y1="19" y2="22"></line>
      </svg>
    ),
  },
  {
    label: "인공지능 지침 설정",
    href: "/settings/ai",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h2a2 2 0 0 1 2 2v2h.5a1.5 1.5 0 0 1 0 3H17v2a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2h-.5a1.5 1.5 0 0 1 0-3H7V9a2 2 0 0 1 2-2h2V5.73A2 2 0 0 1 12 2z"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="12" y1="10" x2="12" y2="16"/>
      </svg>
    ),
  },
];

import { Suspense } from "react";

export function Sidebar() {
  return (
    <Suspense fallback={<div className={styles.sidebar}>Loading nav...</div>}>
      <SidebarContent />
    </Suspense>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [aiStatus, setAiStatus] = useState<{ status: string; message: string; model: string | null }>({
    status: "checking",
    message: "연결 확인 중...",
    model: null,
  });

  useEffect(() => {
    setReports(getAllReports());
    const handler = () => setReports(getAllReports());
    window.addEventListener("reports-updated", handler);
    return () => window.removeEventListener("reports-updated", handler);
  }, []);

  // Check AI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      let apiKey = "";
      let model = "gemini-2.5-flash";
      try {
        const stored = localStorage.getItem("hana_ai_instructions");
        if (stored) {
          const parsed = JSON.parse(stored);
          apiKey = parsed.apiKey || "";
          model = parsed.model || "gemini-2.5-flash";
        }
      } catch {
        // ignore parsing errors
      }

      try {
        const res = await fetch("/api/ai-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, model }),
        });
        const data = await res.json();
        setAiStatus(data);
      } catch {
        setAiStatus({ status: "error", message: "서버 연결 실패", model: null });
      }
    };

    checkStatus();

    window.addEventListener("ai-instructions-updated", checkStatus);
    return () => window.removeEventListener("ai-instructions-updated", checkStatus);
  }, []);

  function handleNewReport() {
    const report = createNewReport();
    setReports(getAllReports());
    router.push(`/report/new?id=${report.id}`);
  }

  // Get current report ID from URL
  const searchParams = useSearchParams();
  const currentReportId = pathname.startsWith("/report/new")
    ? searchParams?.get("id") || null
    : null;

  const statusColor =
    aiStatus.status === "connected"
      ? "#22c55e"
      : aiStatus.status === "quota"
      ? "#f59e0b"
      : aiStatus.status === "checking"
      ? "#94a3b8"
      : "#ef4444";

  const statusLabel =
    aiStatus.status === "connected"
      ? "AI 연결됨"
      : aiStatus.status === "quota"
      ? "할당량 초과"
      : aiStatus.status === "checking"
      ? "확인 중..."
      : "연결 오류";

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>HANA</span>
          <span className={styles.logoSub}>Supervision AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navLabel}>메뉴</span>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Report list section */}
        <div className={styles.navSection} style={{ marginTop: "var(--space-5)" }}>
          <div className={styles.reportHeader}>
            <span className={styles.navLabel}>보고서 목록</span>
            <button
              className={styles.newReportBtn}
              onClick={handleNewReport}
              title="새 보고서"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          <div className={styles.reportList}>
            {reports.length === 0 ? (
              <div className={styles.reportEmpty}>
                아직 작성된 보고서가 없습니다
              </div>
            ) : (
              reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/report/new?id=${r.id}`}
                  className={`${styles.reportItem} ${
                    currentReportId === r.id ? styles.reportItemActive : ""
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={styles.reportIcon}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className={styles.reportInfo}>
                    <span className={styles.reportTitle}>{r.title}</span>
                    <span className={styles.reportDate}>
                      {new Date(r.updatedAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* Footer with AI status */}
      <div className={styles.sidebarFooter}>
        <div className={styles.aiStatusCard}>
          <div className={styles.aiStatusRow}>
            <span className={styles.aiDot} style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            <div className={styles.aiStatusText}>
              <span className={styles.aiStatusLabel}>{statusLabel}</span>
              {aiStatus.model && (
                <span className={styles.aiStatusModel}>{aiStatus.model}</span>
              )}
            </div>
          </div>
          {aiStatus.status === "quota" && (
            <span className={styles.aiStatusHint}>할당량이 초과되었습니다. 잠시 후 재시도하세요.</span>
          )}
          {aiStatus.status === "error" && (
            <span className={styles.aiStatusHint}>{aiStatus.message}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
