"use client";

import { useEffect, useState } from "react";
import { getDeletedReports, restoreReport, deleteReportPerm, SavedReport } from "@/lib/reportStorage";
import { getDeletedTranscripts, restoreTranscript, deleteTranscriptPerm, TranscriptRecord } from "@/lib/transcriptStorage";

export default function TrashPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  
  const loadData = async () => {
    const r = await getDeletedReports();
    const t = await getDeletedTranscripts();
    setReports(r);
    setTranscripts(t);
  };

  useEffect(() => {
    loadData();
    window.addEventListener("reports-updated", loadData);
    return () => window.removeEventListener("reports-updated", loadData);
  }, []);

  const handleRestoreReport = async (id: string) => {
    await restoreReport(id);
    window.dispatchEvent(new Event("reports-updated"));
    await loadData();
  };

  const handleRestoreTranscript = async (id: string) => {
    await restoreTranscript(id);
    await loadData();
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("이 보고서를 영구 삭제하시겠습니까? 복구할 수 없습니다.")) return;
    await deleteReportPerm(id);
    window.dispatchEvent(new Event("reports-updated"));
    await loadData();
  };

  const handleDeleteTranscript = async (id: string) => {
    if (!confirm("이 축어록을 영구 삭제하시겠습니까? 복구할 수 없습니다.")) return;
    await deleteTranscriptPerm(id);
    await loadData();
  };

  const calculateDaysLeft = (deletedAt: string | number | undefined) => {
    if (!deletedAt) return 30;
    const deletedTime = typeof deletedAt === 'number' ? deletedAt : new Date(deletedAt).getTime();
    const msPassed = new Date().getTime() - deletedTime;
    const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysPassed);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
      <header style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "48px", height: "48px", background: "var(--bg-card)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </div>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 4px 0", color: "var(--gray-900)" }}>휴지통</h1>
          <p style={{ margin: 0, color: "var(--gray-500)" }}>휴지통의 항목들은 30일이 지나면 영구 삭제됩니다.</p>
        </div>
      </header>

      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "18px", color: "var(--gray-800)", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid var(--border-light)" }}>삭제된 보고서</h2>
        {reports.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-light)", color: "var(--gray-500)" }}>삭제된 보고서가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reports.map(r => (
              <div key={r.id} className="card" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--gray-900)", marginBottom: "4px" }}>{r.title}</div>
                  <div style={{ fontSize: "12px", color: "var(--error)" }}>소멸까지 {calculateDaysLeft(r.deletedAt)}일 남음</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleRestoreReport(r.id)} style={{ background: "var(--primary-50)", border: "1px solid var(--primary-200)", color: "var(--primary-700)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>복구</button>
                  <button onClick={() => handleDeleteReport(r.id)} style={{ background: "transparent", border: "1px solid rgba(239, 68, 68, 0.4)", color: "var(--error)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>영구 삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "18px", color: "var(--gray-800)", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid var(--border-light)" }}>삭제된 축어록</h2>
        {transcripts.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-light)", color: "var(--gray-500)" }}>삭제된 축어록이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {transcripts.map(t => (
              <div key={t.id} className="card" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--gray-900)", marginBottom: "4px" }}>축어록_{t.clientName}_{t.sessionDate}.txt</div>
                  <div style={{ fontSize: "12px", color: "var(--error)" }}>소멸까지 {calculateDaysLeft(t.deletedAt)}일 남음</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleRestoreTranscript(t.id)} style={{ background: "var(--primary-50)", border: "1px solid var(--primary-200)", color: "var(--primary-700)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>복구</button>
                  <button onClick={() => handleDeleteTranscript(t.id)} style={{ background: "transparent", border: "1px solid rgba(239, 68, 68, 0.4)", color: "var(--error)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>영구 삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
