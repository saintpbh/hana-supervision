"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import {
  type ReportFormData,
  INITIAL_FORM_DATA,
} from "@/types/report";
import { SCT_QUESTIONS, MMPI2_SCALES } from "@/constants/report";
import { getReport, saveReport, createNewReport } from "@/lib/reportStorage";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

const STEPS = [
  { title: "상담 정보", desc: "상담자, 기관, 슈퍼바이저" },
  { title: "내담자 정보", desc: "인적 사항" },
  { title: "상담 내용 요약", desc: "회기 요약, 축어록" },
  { title: "심리검사 데이터", desc: "SCT, MMPI-2, TCI 결과" },
  { title: "종합보고서", desc: "AI 생성 및 편집" },
];

import { Suspense } from "react";

export default function NewReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>}>
      <NewReportContent />
    </Suspense>
  );
}

function NewReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reportIdParam = searchParams.get("id");

  const [reportId, setReportId] = useState<string | null>(reportIdParam);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReportFormData>(INITIAL_FORM_DATA);
  const [loadingState, setLoadingState] = useState<{ title: string; desc: string } | null>(null);
  const [reportContent, setReportContent] = useState("");
  const [referenceContent, setReferenceContent] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const [generationMode, setGenerationMode] = useState<string>("single");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pastStates, setPastStates] = useState<ReportFormData[]>([]);
  
  // Save debounced history states for Undo
  useEffect(() => {
    const timer = setTimeout(() => {
      setPastStates((prev) => {
        // Prevent saving consecutive identical states
        if (prev.length === 0 || JSON.stringify(prev[prev.length - 1]) !== JSON.stringify(formData)) {
          return [...prev.slice(-29), formData];
        }
        return prev;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [formData]);

  const handleUndo = () => {
    if (pastStates.length <= 1) {
      alert("더 이상 되돌릴 수 있는 이전 상태가 없습니다.");
      return;
    }
    // pop the current state (which is the last element because of debounce), and get the one before it
    const newStates = [...pastStates];
    if (JSON.stringify(newStates[newStates.length - 1]) === JSON.stringify(formData)) {
      newStates.pop(); // remove current state if it matches formData
    }
    const targetState = newStates.pop();
    if (targetState) {
      setFormData(targetState);
      autoSaveAll(targetState);
      setPastStates(newStates);
      alert("✅ 이전 상태로 복구되었습니다.");
    }
  };

  function nowTime() {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}:${n.getSeconds().toString().padStart(2, "0")}`;
  }

  const [reportVersions, setReportVersions] = useState<{ reportContent: string; referenceContent?: string; createdAt: string }[]>([]);

  /* ── autosave to report storage ── */
  const autoSaveAll = useCallback((fd?: ReportFormData, rc?: string, refC?: string, saveAsVersion = false) => {
    const SAVE_MSGS = [
      "✅ 안전하게 저장되었습니다",
      "💾 입력 내용이 저장되었습니다",
      "🔒 데이터가 안전하게 보관됩니다",
      "✨ 저장 완료! 안심하세요",
      "📋 작성 내용이 보존되었습니다",
    ];
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const currentFd = fd ?? formData;
      const currentRc = rc ?? reportContent;
      const currentRefC = refC ?? referenceContent;
      const saved = await saveReport(reportId, currentFd, currentRc, currentRefC, saveAsVersion);
      if (!reportId) {
        setReportId(saved.id);
        window.history.replaceState(null, "", `/report/new?id=${saved.id}`);
      }
      if (saved.versions) {
        setReportVersions(saved.versions);
      }
      // Notify sidebar
      window.dispatchEvent(new Event("reports-updated"));
      setLastSavedAt(nowTime());
      const msg = SAVE_MSGS[Math.floor(Math.random() * SAVE_MSGS.length)];
      setSaveMessage(msg);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setSaveMessage(null), 5000);
    }, 1000);
  }, [formData, reportContent, referenceContent, reportId]);

  /* ── load report on mount or when ID changes ── */
  useEffect(() => {
    const loadState = async () => {
      // URL의 파라미터를 최우선 기준으로 삼아 Stale State 차단
      const currentId = searchParams.get("id");
      
      // 1. 기존 리포트 불러오기 모드
      if (currentId) {
        setReportId(currentId);
        const existing = await getReport(currentId);
        if (existing) {
          setFormData(existing.formData);
          setReportContent(existing.reportContent || "");
          setReferenceContent(existing.referenceContent || "");
          setReportVersions(existing.versions || []);
          return;
        }
      }
      
      // 2. 신규 리포트 생성 모드 (접속 시 ID가 없거나 DB에서 못 찾은 경우)
      const fresh = await createNewReport();
      setReportId(fresh.id);
      
      // ✨ 핵심 누수 방지 로직: 이전 객체의 참조(Reference)를 끊음 (Deep Clone)
      setFormData(JSON.parse(JSON.stringify(fresh.formData)));
      setReportContent("");
      setReferenceContent("");
      setReportVersions([]);
      
      // 사용하지 않는 이전 로컬 스토리지 데이터들 강제 삭제 (Context Contamination 원천 차단)
      localStorage.removeItem("hana_report_draft_fd");
      localStorage.removeItem("hana_report_draft");
      localStorage.removeItem("hana_reference_draft");
      
      router.replace(`/report/new?id=${fresh.id}`);
      window.dispatchEvent(new Event("reports-updated"));
    };
    loadState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ── helpers (all trigger autosave) ── */
  function updateAdmin(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, adminInfo: { ...prev.adminInfo, [field]: value } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateClient(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, clientProfile: { ...prev.clientProfile, [field]: value } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateSCT(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, testData: { ...prev.testData, sct: { ...prev.testData.sct, [field]: value } } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateSCTAnswer(id: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, testData: { ...prev.testData, sct: { ...prev.testData.sct, answers: { ...prev.testData.sct.answers, [id]: value } } } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateMMPI2(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, testData: { ...prev.testData, mmpi2: { ...prev.testData.mmpi2, [field]: value } } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateMMPI2Scale(scaleId: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, testData: { ...prev.testData, mmpi2: { ...prev.testData.mmpi2, scales: { ...prev.testData.mmpi2.scales, [scaleId]: value } } } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateTCI(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, testData: { ...prev.testData, tci: { ...prev.testData.tci, [field]: value } } };
      autoSaveAll(next);
      return next;
    });
  }
  function updateSession(field: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, sessionSummary: { ...prev.sessionSummary, [field]: value } };
      autoSaveAll(next);
      return next;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleBulkUpdate(partialData: Record<string, any>) {
    // Before major bulk update, snapshot immediately
    setPastStates((prev) => {
      if (prev.length === 0 || JSON.stringify(prev[prev.length - 1]) !== JSON.stringify(formData)) {
        return [...prev.slice(-29), formData];
      }
      return prev;
    });

    setFormData((prev) => {
      const next = { ...prev };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mergeSafely = (target: any, source: any) => {
        for (const key of Object.keys(source)) {
          // 문서 업로드로 덮어씌울 때, 기존에 값이 있는 상태에서 빈 값("")으로 엎어치지 않도록 방어
          if (source[key] !== undefined && source[key] !== null) {
            if (typeof source[key] === 'string' && source[key].trim() === "" && target[key]) {
              continue; // 기존에 값이 유지되도록 스킵
            }
            if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
               target[key] = { ...target[key] };
               mergeSafely(target[key], source[key]);
            } else {
               target[key] = source[key];
            }
          }
        }
      };

      if (partialData.adminInfo) {
        next.adminInfo = { ...prev.adminInfo };
        mergeSafely(next.adminInfo, partialData.adminInfo);
      }
      if (partialData.clientProfile) {
        next.clientProfile = { ...prev.clientProfile };
        mergeSafely(next.clientProfile, partialData.clientProfile);
      }
      if (partialData.sct) {
        next.testData = { ...next.testData, sct: { ...next.testData.sct } };
        mergeSafely(next.testData.sct, partialData.sct);
      }
      if (partialData.mmpi2) {
        next.testData = { ...next.testData, mmpi2: { ...next.testData.mmpi2 } };
        mergeSafely(next.testData.mmpi2, partialData.mmpi2);
      }
      if (partialData.tci) {
        next.testData = { ...next.testData, tci: { ...next.testData.tci } };
        mergeSafely(next.testData.tci, partialData.tci);
      }
      
      autoSaveAll(next);
      return next;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDocumentUpload = async (file: File, target: string, onParsed: (data: Record<string, any>) => void) => {
    if (!file) return;
    setLoadingState({
      title: "문서 분석 중...",
      desc: "Gemini AI가 문서를 읽고 전문 정보를 추출하고 있습니다.\n잠시만 기다려주세요."
    });

    try {
      let aiInstructions = null;
      try {
        const stored = localStorage.getItem("hana_ai_instructions");
        if (stored) aiInstructions = JSON.parse(stored);
      } catch {}

      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        const arrayBuffer = await file.arrayBuffer();
        let decodedText = "";
        try {
          decodedText = new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer);
        } catch {
          decodedText = new TextDecoder("euc-kr").decode(arrayBuffer);
        }
        
        try {
          const res = await fetch("/api/parse-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileText: decodedText,
              mimeType: file.type || "text/plain",
              aiInstructions,
              target
            }),
          });
          const data = await res.json();
          if (data.success && data.parsedData) {
            onParsed(data.parsedData);
          } else {
            alert(data.error || "분석에 실패했습니다.");
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "네트워크 오류";
          alert(`분석 실패: ${message}`);
        } finally {
          setLoadingState(null);
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        try {
          const res = await fetch("/api/parse-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: file.type,
              aiInstructions,
              target
            }),
          });
          const data = await res.json();
          if (data.success && data.parsedData) {
            onParsed(data.parsedData);
          } else {
            alert(data.error || "분석에 실패했습니다.");
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "네트워크 오류";
          alert(`분석 실패: ${message}`);
        } finally {
          setLoadingState(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setLoadingState(null);
      alert("파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  /* ── AI generate ── */
  async function handleGenerate() {
    let aiInstructions = null;
    try {
      const stored = localStorage.getItem("hana_ai_instructions");
      if (stored) aiInstructions = JSON.parse(stored);
    } catch {}

    setLoadingState({
      title: "파이프라인 시작 대기 중...",
      desc: "네트워크를 연결하고 AI 엔진을 초기화하고 있습니다."
    });

    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ data: formData, aiInstructions }),
      });

      if (!res.ok || !res.body) {
        let errMessage = "오류가 발생했습니다.";
        try {
          const errData = await res.json();
          if (errData.error) errMessage = errData.error;
        } catch {}
        throw new Error(errMessage);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      
      let finalReference = "";
      let finalReport = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          if (!chunk) continue;
          
          if (chunk.startsWith("event: ")) {
            const lines = chunk.split("\n");
            const eventType = lines[0].substring(7).trim();
            const dataStr = lines[1]?.substring(6).trim();
            
            if (eventType === "ping") continue;

            const data = dataStr ? JSON.parse(dataStr) : null;
            
            if (eventType === "status" && data) {
              setLoadingState(data);
            } else if (eventType === "done" && data) {
              finalReference = data.reference;
              finalReport = data.report;
              setReferenceContent(data.reference);
              setReportContent(data.report);
              if (data.usage) setTokenUsage(data.usage);
            } else if (eventType === "finish" && data) {
              if (data.mode) setGenerationMode(data.mode);
            } else if (eventType === "error") {
              throw new Error(data?.message || "서버 에러가 발생했습니다.");
            }
          }
        }
      }
      
      if (finalReference && finalReport) {
        localStorage.setItem("hana_reference_draft", finalReference);
        localStorage.setItem("hana_report_draft", finalReport);
        autoSaveAll(formData, finalReport, finalReference, true);
        
        setLastSavedAt(nowTime());
        setSaveMessage("🎉 두 개의 보고서가 생성되고 DB 및 버전에 보존되었습니다!");
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setSaveMessage(null), 5000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
      alert(message);
    } finally {
      setLoadingState(null);
    }
  }

  /* ── download ── */
  async function handleDownload(format: "txt" | "docx" | "md", content: string, label: string) {
    const clientCode = formData.clientProfile.clientCode || "report";
    const date = new Date().toISOString().slice(0, 10);
    const title = `슈퍼비전보고서_${label}_${clientCode}_${date}`;

    if (format === "docx") {
      const paragraphs = content.split('\n').map(line => {
        let isBold = false;
        let pText = line;
        let headingLevel = 0;

        if (line.startsWith("### ")) {
          headingLevel = 3; pText = line.replace("### ", ""); isBold = true;
        } else if (line.startsWith("## ")) {
          headingLevel = 2; pText = line.replace("## ", ""); isBold = true;
        } else if (line.startsWith("# ")) {
          headingLevel = 1; pText = line.replace("# ", ""); isBold = true;
        }

        return new Paragraph({
          children: [
            new TextRun({
              text: pText,
              font: "Malgun Gothic",
              size: headingLevel === 1 ? 32 : headingLevel === 2 ? 28 : headingLevel === 3 ? 24 : 20,
              bold: isBold
            }),
          ],
          spacing: { after: 120 }
        });
      });

      const doc = new Document({
        sections: [{ children: paragraphs }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title}.docx`);
    } else {
      const mime = format === "txt" ? "text/plain;charset=utf-8" : "text/markdown;charset=utf-8";
      const blob = new Blob([content], { type: mime });
      saveAs(blob, `${title}.${format}`);
    }
  }

  /* ── report content change ── */
  function handleReportChange(newContent: string) {
    setReportContent(newContent);
    autoSaveAll(undefined, newContent, undefined, false);
  }

  function handleReferenceChange(newContent: string) {
    setReferenceContent(newContent);
    autoSaveAll(undefined, undefined, newContent, false);
  }

  function handleRestoreVersion(content: string, refContent?: string) {
    if (confirm("해당 버전의 보고서 내용으로 덮어쓰시겠습니까?")) {
      setReportContent(content);
      if (refContent) setReferenceContent(refContent);
      autoSaveAll(undefined, content, refContent, false);
      alert("이전 버전으로 복원되었습니다.");
    }
  }

  /* ── rendering ── */
  return (
    <div className={styles.container}>
      {loadingState && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <div className="loading-title">{loadingState.title}</div>
            <div className="loading-desc">
              {loadingState.desc.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left: Stepper & Version History */}
      <aside className={styles.stepperPanel} style={{ display: 'flex', flexDirection: 'column' }}>
        <div>
          <h2 className={styles.stepperTitle}>보고서 작성</h2>
          <p className={styles.stepperSubtitle}>정규양식에 따라 입력하세요</p>
          <div className="stepper" style={{ marginTop: "var(--space-8)" }}>
            {STEPS.map((s, i) => {
              let state = "";
              if (i < step) state = "completed";
              else if (i === step) state = "active";
              return (
                <div key={i} className={`stepper-item ${state}`} onClick={() => setStep(i)}>
                  <div className="stepper-circle">
                    {i < step ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : `0${i + 1}`}
                  </div>
                  <div className="stepper-text">
                    <div className="stepper-title">{s.title}</div>
                    <div className="stepper-desc">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save indicator */}
        <div className={styles.saveIndicator} style={{ marginBottom: reportVersions.length > 0 ? "16px" : "auto" }}>
          {saveMessage ? (
            <div className={styles.saveToast}>{saveMessage}</div>
          ) : lastSavedAt ? (
            <div className={styles.saveQuiet}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              마지막 저장: {lastSavedAt}
            </div>
          ) : (
            <div className={styles.saveQuiet}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              입력하시면 자동 저장됩니다
            </div>
          )}
        </div>

        {/* Version History List */}
        {reportVersions.length > 0 && (
          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px", maxHeight: "30vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc", marginBottom: "12px" }}>🤖 이전 생성 버전 (기록)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {reportVersions.map((v, i) => (
                <div key={i} className="glass-card" style={{ padding: "10px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#cbd5e1" }}>생성: {new Date(v.createdAt).toLocaleString()}</div>
                    <div style={{ color: "#64748b", marginTop: "2px" }}>글 길이: {v.reportContent.length}자</div>
                  </div>
                  <button onClick={() => handleRestoreVersion(v.reportContent, v.referenceContent)} style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.3)", color: "#c084fc", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    불러오기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Right: Form content */}
      <div className={styles.formPanel}>
        <div className={`card animate-fade-in ${styles.formCard}`} key={step}>
          {step === 0 && <Step1Admin data={formData} onChange={updateAdmin} onFileUpload={handleDocumentUpload} onBulkUpdate={handleBulkUpdate} />}
          {step === 1 && <Step2Client data={formData} onChange={updateClient} />}
          {step === 2 && <Step4Session data={formData} onChange={updateSession} />}
          {step === 3 && (
            <Step3Tests data={formData} onChangeSCT={updateSCT} onChangeSCTAnswer={updateSCTAnswer}
              onChangeMMPI2={updateMMPI2} onChangeMMPI2Scale={updateMMPI2Scale} onChangeTCI={updateTCI}
              onFileUpload={handleDocumentUpload} onBulkUpdate={handleBulkUpdate} />
          )}
          {step === 4 && (
            <Step5Report 
              reportContent={reportContent}
              referenceContent={referenceContent}
              onChangeReport={handleReportChange}
              onChangeReference={handleReferenceChange}
              onGenerate={handleGenerate}
              onDownload={handleDownload}
              isGenerating={!!loadingState} lastSavedAt={lastSavedAt}
              tokenUsage={tokenUsage} generationMode={generationMode} />
          )}

          {/* Nav buttons */}
          <div className={styles.formNav}>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {step > 0 && (
                <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>← 이전 단계</button>
              )}
              {pastStates.length > 1 && (
                <button className="btn btn-outline" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }} onClick={handleUndo}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3l-3 2.7" />
                  </svg>
                  되돌리기 (실행 취소)
                </button>
              )}
            </div>
            <div className={styles.navRight}>
              {step < STEPS.length - 1 && (
                <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                  {step === 3 ? "종합보고서 →" : "다음 단계 →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Step 1: Administrative Info
   ════════════════════════════════════════ */
function Step1Admin({
  data,
  onChange,
  onFileUpload,
  onBulkUpdate,
}: {
  data: ReportFormData;
  onChange: (field: string, value: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFileUpload: (file: File, target: string, onParsed: (data: Record<string, any>) => void) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBulkUpdate: (partialData: Record<string, any>) => void;
}) {
  const d = data.adminInfo;
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const processFile = async (file: File) => {
    onFileUpload(file, "admin", (parsedData) => {
      onBulkUpdate(parsedData);
      alert("✅ 문서 분석 완료! 상담 정보와 내담자 정보가 확인되었습니다.");
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>상담 정보</h2>
        <p className={styles.stepDesc}>상담 진행 관련 기본 정보를 입력하세요</p>
      </div>

      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
        style={{ padding: "var(--space-6) var(--space-4)", minHeight: "100px", marginBottom: "var(--space-6)" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept=".pdf,.txt"
          onChange={handleFileSelect}
        />
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className={styles.dropzoneIcon} style={{ width: "32px", height: "32px", marginBottom: "var(--space-2)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
        <div>
          <div className={styles.dropzoneTitle} style={{ fontSize: "14px" }}>상담 일지 업로드 (자동 입력)</div>
          <div className={styles.dropzoneSubtitle} style={{ fontSize: "13px" }}>
            PDF나 TXT 파일을 드래그하거나 아래 버튼을 클릭하여 업로드하세요
          </div>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => fileInputRef.current?.click()}
          style={{ marginTop: "var(--space-3)", fontSize: "13px", padding: "6px 12px" }}
        >
          파일 선택하기
        </button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            상담자 이름 <span className="required">*</span>
          </label>
          <input
            className="form-input"
            placeholder="홍길동"
            value={d.counselorName}
            onChange={(e) => onChange("counselorName", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            소속 기관 <span className="required">*</span>
          </label>
          <input
            className="form-input"
            placeholder="OO 상담센터"
            value={d.organization}
            onChange={(e) => onChange("organization", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">
          슈퍼바이저 <span className="required">*</span>
        </label>
        <input
          className="form-input"
          placeholder="김슈퍼"
          value={d.supervisorName}
          onChange={(e) => onChange("supervisorName", e.target.value)}
        />
      </div>

      <div className="form-row" style={{ marginTop: "var(--space-5)" }}>
        <div className="form-group">
          <label className="form-label">일시</label>
          <input
            className="form-input"
            type="text"
            placeholder="2024-05-12"
            value={d.sessionDate}
            onChange={(e) => onChange("sessionDate", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">장소</label>
          <input
            className="form-input"
            placeholder="상담실 201호"
            value={d.location}
            onChange={(e) => onChange("location", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Step 2: Client Profile + Theory Selection
   ════════════════════════════════════════ */
function Step2Client({
  data,
  onChange,
}: {
  data: ReportFormData;
  onChange: (field: string, value: string) => void;
}) {
  const d = data.clientProfile;

  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>내담자 정보</h2>
        <p className={styles.stepDesc}>내담자 인적 사항을 입력하세요</p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            내담자 코드 <span className="required">*</span>
          </label>
          <input
            className="form-input"
            placeholder="C-2026-001"
            value={d.clientCode}
            onChange={(e) => onChange("clientCode", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">연령</label>
          <input
            className="form-input"
            placeholder="32"
            value={d.age}
            onChange={(e) => onChange("age", e.target.value)}
          />
        </div>
      </div>

      <div className="form-row" style={{ marginTop: "var(--space-5)" }}>
        <div className="form-group">
          <label className="form-label">성별</label>
          <select
            className="form-select"
            value={d.gender}
            onChange={(e) => onChange("gender", e.target.value)}
          >
            <option value="">선택하세요</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">직업</label>
          <input
            className="form-input"
            placeholder="직업을 입력하세요"
            value={d.occupation}
            onChange={(e) => onChange("occupation", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">
          주 호소 문제 <span className="required">*</span>
        </label>
        <textarea
          className="form-textarea"
          placeholder="내담자가 호소하는 주요 문제를 기술하세요..."
          value={d.chiefComplaint}
          onChange={(e) => onChange("chiefComplaint", e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">상담 동기 및 경위</label>
        <textarea
          className="form-textarea"
          placeholder="상담을 시작하게 된 동기 및 경위를 기술하세요..."
          value={d.counselingMotivation}
          onChange={(e) => onChange("counselingMotivation", e.target.value)}
          style={{ minHeight: "80px" }}
        />
      </div>

    </>
  );
}

/* ════════════════════════════════════════
   Step 3: Psychological Test Data
   ════════════════════════════════════════ */
function Step3Tests({
  data,
  onChangeSCT,
  onChangeSCTAnswer,
  onChangeMMPI2,
  onChangeMMPI2Scale,
  onChangeTCI,
  onFileUpload,
  onBulkUpdate,
}: {
  data: ReportFormData;
  onChangeSCT: (field: string, value: string) => void;
  onChangeSCTAnswer: (id: string, value: string) => void;
  onChangeMMPI2: (field: string, value: string) => void;
  onChangeMMPI2Scale: (scaleId: string, value: string) => void;
  onChangeTCI: (field: string, value: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFileUpload: (file: File, target: string, onParsed: (data: Record<string, any>) => void) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBulkUpdate: (partialData: Record<string, any>) => void;
}) {
  const [activeTab, setActiveTab] = useState<"sct" | "mmpi2" | "tci">("sct");
  
  const TestDropzone = ({ target, label }: { target: "sct" | "mmpi2" | "tci", label: string }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const processFile = (file: File) => {
      onFileUpload(file, target, (parsedData) => {
        onBulkUpdate(parsedData);
        alert(`✅ ${label} 문서 분석 및 입력 완료!`);
      });
    };

    return (
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
        style={{ padding: "var(--space-6) var(--space-4)", minHeight: "100px", marginBottom: "var(--space-6)" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept=".pdf,.txt"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className={styles.dropzoneIcon} style={{ width: "32px", height: "32px", marginBottom: "var(--space-2)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
        <div>
          <div className={styles.dropzoneTitle} style={{ fontSize: "14px" }}>{label} 문서 업로드 (AI 분석)</div>
          <div className={styles.dropzoneSubtitle} style={{ fontSize: "13px" }}>
            결과지를 드래그하거나 아래 기능 버튼을 클릭하세요
          </div>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => fileInputRef.current?.click()}
          style={{ marginTop: "var(--space-3)", fontSize: "13px", padding: "6px 12px" }}
        >
          파일 선택하기
        </button>
      </div>
    );
  };

  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>심리검사 데이터</h2>
        <p className={styles.stepDesc}>
          각 심리검사의 결과 및 수치를 입력하세요. AI가 통합적으로 해석합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className={styles.testTabs}>
        {(["sct", "mmpi2", "tci"] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.testTab} ${activeTab === tab ? styles.testTabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "sct" && "SCT (문장완성검사)"}
            {tab === "mmpi2" && "MMPI-2"}
            {tab === "tci" && "TCI (기질·성격)"}
          </button>
        ))}
      </div>

      {/* SCT */}
      {activeTab === "sct" && (
        <div className="animate-fade-in">
          <TestDropzone target="sct" label="SCT (문장완성검사)" />
          {SCT_QUESTIONS.map((section, idx) => (
            <div key={idx} style={{ marginBottom: "var(--space-6)" }}>
              <h3 className={styles.subSectionTitle}>{section.category}</h3>
              {section.items.map((item) => (
                <div key={item.id} className="form-group" style={{ marginBottom: "var(--space-2)" }}>
                  <label className="form-label" style={{ fontWeight: 500 }}>
                    {item.id}. {item.text}
                  </label>
                  <input
                    className="form-input"
                    value={data.testData.sct.answers[item.id] || ""}
                    onChange={(e) => onChangeSCTAnswer(item.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))}

          <div className="form-group" style={{ marginTop: "var(--space-6)" }}>
            <label className="form-label">해석 포인트 및 종합 소견 (선택)</label>
            <textarea
              className="form-textarea"
              placeholder="특이사항이나 해석이 필요한 포인트가 있다면 입력하세요..."
              value={data.testData.sct.interpretation}
              onChange={(e) => onChangeSCT("interpretation", e.target.value)}
              style={{ minHeight: "80px" }}
            />
          </div>
        </div>
      )}

      {/* MMPI-2 */}
      {activeTab === "mmpi2" && (
        <div className="animate-fade-in">
          <TestDropzone target="mmpi2" label="MMPI-2" />
           {MMPI2_SCALES.map((section, idx) => (
            <div key={idx} style={{ marginBottom: "var(--space-5)" }}>
              <h3 className={styles.subSectionTitle}>{section.category}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "var(--space-3)" }}>
                {section.scales.map((scale) => (
                  <div key={scale} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "13px", color: "var(--color-text)", fontWeight: 500 }}>{scale}</label>
                    <input
                      className="form-input"
                      value={data.testData.mmpi2.scales[scale] || ""}
                      onChange={(e) => onChangeMMPI2Scale(scale, e.target.value)}
                      style={{ padding: "0.25rem 0.5rem" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="form-row" style={{ marginTop: "var(--space-6)" }}>
            <div className="form-group">
              <label className="form-label">코드 타입</label>
              <input
                className="form-input"
                placeholder="예) 2-7"
                value={data.testData.mmpi2.codeType}
                onChange={(e) => onChangeMMPI2("codeType", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">유의미한 상승 척도</label>
              <input
                className="form-input"
                placeholder="예) D(우울), Pt(강박) 유의미한 상승"
                value={data.testData.mmpi2.significantScales}
                onChange={(e) => onChangeMMPI2("significantScales", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* TCI */}
      {activeTab === "tci" && (
        <div className="animate-fade-in">
          <TestDropzone target="tci" label="TCI" />
          <p className="form-hint" style={{ marginBottom: "var(--space-5)" }}>
            기질 차원 4개와 성격 차원 3개의 T점수 또는 백분위를 입력하세요.
          </p>
          <h3 className={styles.subSectionTitle}>기질 차원 (Temperament)</h3>
          <div className="form-row" style={{ marginBottom: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">자극추구 (NS)</label>
              <input className="form-input" placeholder="T점수 또는 백분위" value={data.testData.tci.noveltySeekingNS} onChange={(e) => onChangeTCI("noveltySeekingNS", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">위험회피 (HA)</label>
              <input className="form-input" placeholder="T점수 또는 백분위" value={data.testData.tci.harmAvoidanceHA} onChange={(e) => onChangeTCI("harmAvoidanceHA", e.target.value)} />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: "var(--space-5)" }}>
            <div className="form-group">
              <label className="form-label">사회적 민감성 (RD)</label>
              <input className="form-input" placeholder="T점수 또는 백분위" value={data.testData.tci.rewardDependenceRD} onChange={(e) => onChangeTCI("rewardDependenceRD", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">인내력 (P)</label>
              <input className="form-input" placeholder="T점수 또는 백분위" value={data.testData.tci.persistenceP} onChange={(e) => onChangeTCI("persistenceP", e.target.value)} />
            </div>
          </div>

          <h3 className={styles.subSectionTitle}>성격 차원 (Character)</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">자율성 (SD)</label>
              <input className="form-input" placeholder="T점수" value={data.testData.tci.selfDirectednessSD} onChange={(e) => onChangeTCI("selfDirectednessSD", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">연대감 (C)</label>
              <input className="form-input" placeholder="T점수" value={data.testData.tci.cooperativenessC} onChange={(e) => onChangeTCI("cooperativenessC", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">자기초월 (ST)</label>
              <input className="form-input" placeholder="T점수" value={data.testData.tci.selfTranscendenceST} onChange={(e) => onChangeTCI("selfTranscendenceST", e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Step 4: Session Summary
   ════════════════════════════════════════ */
function Step4Session({
  data,
  onChange,
}: {
  data: ReportFormData;
  onChange: (field: string, value: string) => void;
}) {
  const d = data.sessionSummary;
  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>상담 내용 요약</h2>
        <p className={styles.stepDesc}>주요 상담 회기 내용을 정리하세요</p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">회기 번호</label>
          <input
            className="form-input"
            placeholder="(예) 제5회기"
            value={d.sessionNumber}
            onChange={(e) => onChange("sessionNumber", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">상담 일자</label>
          <input
            className="form-input"
            type="date"
            value={d.sessionDate}
            onChange={(e) => onChange("sessionDate", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">
          주요 상담 내용 <span className="required">*</span>
        </label>
        <textarea
          className="form-textarea"
          placeholder="이번 회기에서 다룬 핵심 주제와 내담자의 주요 발화를 정리하세요..."
          value={d.sessionContent}
          onChange={(e) => onChange("sessionContent", e.target.value)}
          style={{ minHeight: "140px" }}
        />
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">핵심 축어록</label>
        <textarea
          className="form-textarea"
          placeholder="내담자와 상담자 간의 핵심 대화를 축어 형태로 입력하세요...&#10;&#10;Co: ...&#10;Cl: ..."
          value={d.keyTranscripts}
          onChange={(e) => onChange("keyTranscripts", e.target.value)}
          style={{ minHeight: "160px" }}
        />
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">상담자 소견</label>
        <textarea
          className="form-textarea"
          placeholder="상담 회기를 통해 느낀 상담자의 소견을 기술하세요..."
          value={d.counselorObservation}
          onChange={(e) => onChange("counselorObservation", e.target.value)}
          style={{ minHeight: "100px" }}
        />
      </div>

      <div className="form-group" style={{ marginTop: "var(--space-5)" }}>
        <label className="form-label">슈퍼비전 요청사항</label>
        <textarea
          className="form-textarea"
          placeholder="슈퍼바이저에게 자문을 구하고 싶은 구체적인 사항을 기술하세요..."
          value={d.supervisionRequest}
          onChange={(e) => onChange("supervisionRequest", e.target.value)}
          style={{ minHeight: "100px" }}
        />
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Step 5: 종합보고서 (AI + 사용자 편집)
   ════════════════════════════════════════ */
function Step5Report({
  reportContent,
  referenceContent,
  onChangeReport,
  onChangeReference,
  onGenerate,
  onDownload,
  isGenerating,
  lastSavedAt,
  tokenUsage,
  generationMode,
}: {
  reportContent: string;
  referenceContent?: string;
  onChangeReport: (content: string) => void;
  onChangeReference: (content: string) => void;
  onGenerate: () => void;
  onDownload: (format: "txt" | "docx" | "md", content: string, label: string) => void;
  isGenerating: boolean;
  lastSavedAt: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenUsage?: any;
  generationMode?: string;
}) {
  const [activeTab, setActiveTab] = useState<"reference" | "report">("report");

  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>종합 분석 결과 및 보고서</h2>
        <p className={styles.stepDesc}>
          AI가 생성한 학술적 레퍼런스와 종합보고서를 검토하고 자유롭게 수정하세요. 학술적 근거 문서를 참조하며 공부할 수 있습니다.
        </p>
      </div>

      {/* Action bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-4)",
        flexWrap: "wrap",
        gap: "var(--space-3)",
      }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={isGenerating}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            {reportContent ? "AI 보고서 재생성" : "AI 보고서 생성"}
          </button>

          {(reportContent || referenceContent) && (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const contentToDownload = activeTab === "report" ? reportContent : (referenceContent || "");
                  const label = activeTab === "report" ? "최종보고서" : "학술근거";
                  onDownload("docx", contentToDownload, label);
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                현재 탭 DOCX 다운로드
              </button>
            </div>
          )}
        </div>

        {lastSavedAt && (
          <span style={{ fontSize: "13px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            자동 저장됨 ({lastSavedAt})
          </span>
        )}
      </div>

      {/* Tabs */}
      {(reportContent || referenceContent) && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "var(--space-3)", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-3)" }}>
          <button
            onClick={() => setActiveTab("reference")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              border: activeTab === "reference" ? "1px solid var(--color-primary)" : "1px solid transparent",
              backgroundColor: activeTab === "reference" ? "rgba(168, 85, 247, 0.1)" : "transparent",
              color: activeTab === "reference" ? "var(--color-primary)" : "var(--color-text-muted)"
            }}
          >
            📚 1부: 학술적 레퍼런스 분석서
          </button>
          <button
            onClick={() => setActiveTab("report")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              border: activeTab === "report" ? "1px solid var(--color-primary)" : "1px solid transparent",
              backgroundColor: activeTab === "report" ? "rgba(168, 85, 247, 0.1)" : "transparent",
              color: activeTab === "report" ? "var(--color-primary)" : "var(--color-text-muted)"
            }}
          >
            📝 2부: 슈퍼비전 종합보고서
          </button>
        </div>
      )}

      {/* Editor */}
      {reportContent || referenceContent ? (
        <textarea
          key={activeTab} // Force re-render on tab switch
          className="form-textarea"
          value={activeTab === "report" ? reportContent : referenceContent || ""}
          onChange={(e) => activeTab === "report" ? onChangeReport(e.target.value) : onChangeReference(e.target.value)}
          placeholder={activeTab === "report" ? "종합보고서 내용이 비어있습니다." : "학술적 레퍼런스 내용이 비어있습니다."}
          style={{
            minHeight: "600px",
            fontFamily: "'Noto Sans KR', monospace",
            fontSize: "14px",
            lineHeight: "1.8",
            whiteSpace: "pre-wrap",
            resize: "vertical",
          }}
        />
      ) : (
        <div style={{
          border: "2px dashed var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-12) var(--space-8)",
          textAlign: "center",
          color: "var(--color-text-muted)",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ margin: "0 auto var(--space-4)", opacity: 0.4 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          <p style={{ fontSize: "16px", fontWeight: 500, marginBottom: "var(--space-2)" }}>아직 보고서가 생성되지 않았습니다</p>
          <p style={{ fontSize: "14px" }}>위의 &quot;AI 보고서 생성&quot; 버튼을 눌러 종합보고서를 작성하세요.</p>
        </div>
      )}

      {/* Token Usage Metrics */}
      {tokenUsage && (
        <div style={{ marginTop: "var(--space-6)", padding: "var(--space-4)", backgroundColor: "rgba(0, 0, 0, 0.15)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            AI 토큰 모니터링 {generationMode === "multi" ? "(멀티 에이전트)" : "(단일 모델)"}
          </h3>
          
          {generationMode === "multi" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              <div style={{ padding: "var(--space-3)", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 600, marginBottom: "4px" }}>Agent 1 (Gemini)</div>
                <div style={{ fontSize: "13px" }}>Prompt: {tokenUsage.gemini?.prompt?.toLocaleString()}</div>
                <div style={{ fontSize: "13px" }}>Completion: {tokenUsage.gemini?.completion?.toLocaleString()}</div>
              </div>
              <div style={{ padding: "var(--space-3)", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "12px", color: "#10a37f", fontWeight: 600, marginBottom: "4px" }}>Agent 2 (GPT-4o)</div>
                <div style={{ fontSize: "13px" }}>Prompt: {tokenUsage.openai?.prompt?.toLocaleString()}</div>
                <div style={{ fontSize: "13px" }}>Completion: {tokenUsage.openai?.completion?.toLocaleString()}</div>
              </div>
              <div style={{ padding: "var(--space-3)", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "12px", color: "#d97757", fontWeight: 600, marginBottom: "4px" }}>Agent 3 (Claude)</div>
                <div style={{ fontSize: "13px" }}>Prompt: {tokenUsage.claude?.prompt?.toLocaleString()}</div>
                <div style={{ fontSize: "13px" }}>Completion: {tokenUsage.claude?.completion?.toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              <div style={{ fontSize: "13px" }}>사용된 프롬프트 토큰: <strong>{tokenUsage.prompt?.toLocaleString()}</strong></div>
              <div style={{ fontSize: "13px" }}>생성된 텍스트 토큰: <strong>{tokenUsage.completion?.toLocaleString()}</strong></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
