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
  { title: "행정 정보", desc: "상담자, 기관, 슈퍼바이저" },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const [generationMode, setGenerationMode] = useState<string>("single");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SAVE_MSGS = [
    "✅ 안전하게 저장되었습니다",
    "💾 입력 내용이 저장되었습니다",
    "🔒 데이터가 안전하게 보관됩니다",
    "✨ 저장 완료! 안심하세요",
    "📋 작성 내용이 보존되었습니다",
  ];

  function nowTime() {
    const n = new Date();
    return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}:${n.getSeconds().toString().padStart(2, "0")}`;
  }

  /* ── autosave to report storage ── */
  const autoSaveAll = useCallback((fd?: ReportFormData, rc?: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const currentFd = fd ?? formData;
      const currentRc = rc ?? reportContent;
      const saved = saveReport(reportId, currentFd, currentRc);
      if (!reportId) {
        setReportId(saved.id);
        window.history.replaceState(null, "", `/report/new?id=${saved.id}`);
      }
      // Notify sidebar
      window.dispatchEvent(new Event("reports-updated"));
      setLastSavedAt(nowTime());
      const msg = SAVE_MSGS[Math.floor(Math.random() * SAVE_MSGS.length)];
      setSaveMessage(msg);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setSaveMessage(null), 3000);
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, reportContent, reportId]);

  /* ── load report on mount or when ID changes ── */
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const existing = getReport(id);
      if (existing) {
        setReportId(id);
        setFormData(existing.formData);
        setReportContent(existing.reportContent);
        setStep(0);
        return;
      }
    }
    // No ID or not found → create new
    const fresh = createNewReport();
    setReportId(fresh.id);
    setFormData(fresh.formData);
    setReportContent("");
    router.replace(`/report/new?id=${fresh.id}`);
    window.dispatchEvent(new Event("reports-updated"));
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
    setFormData((prev) => {
      const next = { ...prev };
      if (partialData.adminInfo) {
        next.adminInfo = { ...prev.adminInfo, ...partialData.adminInfo };
      }
      if (partialData.clientProfile) {
        next.clientProfile = { ...prev.clientProfile, ...partialData.clientProfile };
      }
      if (partialData.sct) {
        next.testData = { ...next.testData, sct: { ...next.testData.sct, ...partialData.sct } };
      }
      if (partialData.mmpi2) {
        next.testData = { ...next.testData, mmpi2: { ...next.testData.mmpi2, ...partialData.mmpi2 } };
      }
      if (partialData.tci) {
        next.testData = { ...next.testData, tci: { ...next.testData.tci, ...partialData.tci } };
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

    const isMultiMode = aiInstructions?.orchestrationMode === "multi";
    
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (isMultiMode) {
      setLoadingState({
        title: "에이전트 1: 구조 분석 중...",
        desc: "Gemini AI가 원본 문서와 심리검사를 분석하고 있습니다.\n전체 과정은 최대 1분 내외가 소요될 수 있습니다."
      });
      let progressStep = 1;
      intervalId = setInterval(() => {
        progressStep++;
        if (progressStep === 2) {
          setLoadingState({
            title: "에이전트 2: 임상 진단 중...",
            desc: "GPT-4o가 DSM-5 기반 임상 진단 소견을 도출하고 있습니다.\n전체 과정은 최대 1분 내외가 소요될 수 있습니다."
          });
        } else if (progressStep === 4) {
          setLoadingState({
            title: "에이전트 3: 최종 서술 중...",
            desc: "Claude가 진단을 통합하여 특수 지침이 반영된 슈퍼비전 보고서를 완성 중입니다.\n전체 과정은 최대 1분 내외가 소요될 수 있습니다."
          });
        }
      }, 7000); 
    } else {
      setLoadingState({
        title: "단일 모델 보고서 생성 중...",
        desc: "AI가 입력하신 데이터를 분석하여\n슈퍼비전 보고서를 작성하고 있습니다."
      });
    }

    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData, aiInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다.");
      setReportContent(data.report);
      if (data.usage) setTokenUsage(data.usage);
      if (data.mode) setGenerationMode(data.mode);
      
      localStorage.setItem("hana_report_draft", data.report);
      setLastSavedAt(nowTime());
      setSaveMessage("🎉 보고서가 생성되고 안전하게 저장되었습니다!");
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      msgTimerRef.current = setTimeout(() => setSaveMessage(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
      alert(message);
    } finally {
      if (intervalId) clearInterval(intervalId);
      setLoadingState(null);
    }
  }

  /* ── download ── */
  async function handleDownload(format: "txt" | "docx" | "md") {
    const clientCode = formData.clientProfile.clientCode || "report";
    const date = new Date().toISOString().slice(0, 10);
    const title = `슈퍼비전보고서_${clientCode}_${date}`;

    if (format === "docx") {
      const paragraphs = reportContent.split('\n').map(line => {
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
      const blob = new Blob([reportContent], { type: mime });
      saveAs(blob, `${title}.${format}`);
    }
  }

  /* ── report content change ── */
  function handleReportChange(newContent: string) {
    setReportContent(newContent);
    autoSaveAll(undefined, newContent);
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

      {/* Left: Stepper */}
      <aside className={styles.stepperPanel}>
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

        {/* Save indicator */}
        <div className={styles.saveIndicator}>
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
            <Step5Report reportContent={reportContent} onChange={handleReportChange}
              onGenerate={handleGenerate} onDownload={handleDownload} isGenerating={!!loadingState} lastSavedAt={lastSavedAt}
              tokenUsage={tokenUsage} generationMode={generationMode} />
          )}

          {/* Nav buttons */}
          <div className={styles.formNav}>
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>← 이전 단계</button>
            )}
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
      alert("✅ 문서 분석 완료! 행정 정보와 내담자 정보가 확인되었습니다.");
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
        <h2 className={styles.stepTitle}>행정 정보</h2>
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
  onChange,
  onGenerate,
  onDownload,
  isGenerating,
  lastSavedAt,
  tokenUsage,
  generationMode,
}: {
  reportContent: string;
  onChange: (content: string) => void;
  onGenerate: () => void;
  onDownload: (format: "txt" | "docx" | "md") => void;
  isGenerating: boolean;
  lastSavedAt: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenUsage?: any;
  generationMode?: string;
}) {
  return (
    <>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>종합 보고서</h2>
        <p className={styles.stepDesc}>
          AI가 생성한 보고서를 검토하고 자유롭게 수정하세요. 내용은 실시간으로 자동 저장됩니다.
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

          {reportContent && (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-secondary"
                onClick={() => onDownload("docx")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                DOCX 형식
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onDownload("txt")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                텍스트 파일 
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

      {/* Editor */}
      {reportContent ? (
        <textarea
          className="form-textarea"
          value={reportContent}
          onChange={(e) => onChange(e.target.value)}
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
