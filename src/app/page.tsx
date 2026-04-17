"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { getAllReports, SavedReport } from "@/lib/reportStorage";

export default function Dashboard() {
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      setReports(await getAllReports());
    };
    fetchReports();
    
    const handleUpdate = () => {
      fetchReports();
    };
    window.addEventListener("reports-updated", handleUpdate);
    return () => window.removeEventListener("reports-updated", handleUpdate);
  }, []);

  const totalCount = reports.length;
  const completedCount = reports.filter(r => r.reportContent.trim().length > 0).length;
  const draftCount = totalCount - completedCount;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">
            슈퍼비전 보고서 현황을 한눈에 확인하세요
          </p>
        </div>
        <Link href="/report/new" className="btn btn-primary btn-lg">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          새 보고서 작성
        </Link>
      </div>

      {/* Metrics */}
      <div className={styles.metricsGrid}>
        <div className={`card ${styles.metricCard}`}>
          <div className={styles.metricIcon} data-color="primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className={styles.metricValue}>{totalCount}</div>
          <div className={styles.metricLabel}>전체 보고서</div>
        </div>
        <div className={`card ${styles.metricCard}`}>
          <div className={styles.metricIcon} data-color="teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className={styles.metricValue}>{completedCount}</div>
          <div className={styles.metricLabel}>완료됨</div>
        </div>
        <div className={`card ${styles.metricCard}`}>
          <div className={styles.metricIcon} data-color="warning">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className={styles.metricValue}>{draftCount}</div>
          <div className={styles.metricLabel}>작성 중</div>
        </div>
      </div>

      {/* Recent reports */}
      <div className={`card animate-fade-in-delay ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <h2 className="section-title">최근 보고서</h2>
          <span className="badge badge-gray">{reports.length}건</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>진행 회기 번호</th>
              <th>내담자 코드</th>
              <th>상태</th>
              <th>작성일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.length > 0 ? reports.slice(0, 10).map((r) => {
              const status = r.reportContent.trim().length > 0 ? "completed" : "draft";
              return (
                <tr key={r.id}>
                  <td className={styles.codeCell}>{r.formData.sessionSummary.sessionNumber || "N/A"}</td>
                  <td>
                    <span className="badge badge-primary">{r.formData.clientProfile.clientCode || "미지정"}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${status === "completed" ? "badge-teal" : "badge-warning"}`}
                    >
                      {status === "completed" ? "완료" : "작성 중"}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{new Date(r.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/report/new?id=${r.id}`} className="btn btn-ghost" style={{ fontSize: "var(--text-xs)" }}>
                      보기 →
                    </Link>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "var(--space-8)" }}>
                  <p style={{ color: "var(--color-text-muted)" }}>아직 작성된 보고서가 없습니다.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick guides */}
      <div className={styles.guidesGrid}>
        <div className={`card ${styles.guideCard}`}>
          <div className={styles.guideIcon}>📋</div>
          <h3>정규양식 입력</h3>
          <p>행정 정보, 내담자 정보, 심리검사 결과, 상담 내용을 4단계로 입력하세요.</p>
        </div>
        <div className={`card ${styles.guideCard}`}>
          <div className={styles.guideIcon}>🧠</div>
          <h3>상담 이론 선택</h3>
          <p>정신역동, 대상관계, 인지행동, 수용전념 중 원하는 이론을 선택하세요.</p>
        </div>
        <div className={`card ${styles.guideCard}`}>
          <div className={styles.guideIcon}>✨</div>
          <h3>AI 자동 생성</h3>
          <p>Gemini AI가 심리검사 해석과 사례개념화를 자동으로 수행합니다.</p>
        </div>
      </div>
    </div>
  );
}
