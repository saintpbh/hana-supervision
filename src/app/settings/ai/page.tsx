"use client";

import { useAIInstructions, AIInstructions } from "@/hooks/useAIInstructions";
import { type CounselingTheory, THEORY_LABELS, THEORY_DESCRIPTIONS } from "@/types/report";
import { useState, useEffect } from "react";
import styles from "./page.module.css";

export default function AIInstructionsPage() {
  const { instructions, saveInstructions } = useAIInstructions();
  const [localData, setLocalData] = useState<AIInstructions>(instructions);

  useEffect(() => {
    setLocalData(instructions);
  }, [instructions]);

  const [savedMessage, setSavedMessage] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<"idle" | "testing" | "success" | "warning" | "error">("idle");
  const [aiTestMessage, setAiTestMessage] = useState("");

  const toggleTheory = (t: CounselingTheory) => {
    setLocalData((prev) => {
      const isSelected = prev.selectedTheories.includes(t);
      if (isSelected) {
        return { ...prev, selectedTheories: prev.selectedTheories.filter((th) => th !== t) };
      } else {
        return { ...prev, selectedTheories: [...prev.selectedTheories, t] };
      }
    });
  };

  const handleSave = () => {
    saveInstructions(localData);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <div className="page animate-fade-in" style={{ padding: "var(--space-6)" }}>
      <header style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="text-xl" style={{ fontWeight: 600, color: "var(--color-primary)" }}>💡 인공지능 지침 설정</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
          새 보고서를 작성할 때 AI가 참고할 전역 지침(이론, 분석 방향성 등)을 설정합니다.
        </p>
      </header>

      <div className="card" style={{ maxWidth: "800px" }}>
        {/* 0. API Key Settings */}
        <div style={{ marginBottom: "var(--space-8)", paddingBottom: "var(--space-6)", borderBottom: "1px solid var(--border-color)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>API 키 설정</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-4)" }}>Google Gemini API 키를 입력하세요. 비워두면 기본으로 제공되는 제한된 키를 사용합니다 (테스트용).</p>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: "200px" }}>
              <input
                type="password"
                className="input-text"
                placeholder="AIzaSy..."
                value={localData.apiKey || ""}
                onChange={(e) => setLocalData({ ...localData, apiKey: e.target.value })}
                style={{ width: "100%", padding: "var(--space-2) var(--space-3)", fontSize: "14px", fontFamily: "monospace" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: "150px" }}>
              <select
                className="input-text"
                value={localData.model || "gemini-2.0-flash"}
                onChange={(e) => setLocalData({ ...localData, model: e.target.value })}
                style={{ width: "100%", padding: "var(--space-2) var(--space-3)", fontSize: "14px", height: "100%", cursor: "pointer", backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (최신/빠름)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (권장)</option>
                <option value="gemini-2.0-pro-exp">gemini-2.0-pro-exp (실험/고성능)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (안정/고성능)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (빠름)</option>
              </select>
            </div>
            <button 
              className="btn-outline" 
              onClick={async () => {
                setAiTestStatus("testing");
                try {
                  const res = await fetch("/api/ai-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      apiKey: localData.apiKey,
                      model: localData.model || "gemini-2.0-flash" 
                    }),
                  });
                  const data = await res.json();
                  if (data.status === "connected") {
                    setAiTestStatus("success");
                    setAiTestMessage(`연결 성공! (${data.model})`);
                  } else if (data.status === "quota") {
                    setAiTestStatus("warning");
                    setAiTestMessage("할당량 초과. 키는 유효합니다.");
                  } else {
                    setAiTestStatus("error");
                    setAiTestMessage(data.message || "연결 실패");
                  }
                } catch {
                  setAiTestStatus("error");
                  setAiTestMessage("네트워크 오류");
                }
              }}
              style={{ padding: "var(--space-2) var(--space-4)" }}
            >
              테스트
            </button>
          </div>
          {aiTestStatus !== "idle" && (
            <div style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              backgroundColor: 
                aiTestStatus === "success" ? "rgba(34, 197, 94, 0.1)" :
                aiTestStatus === "warning" ? "rgba(245, 158, 11, 0.1)" :
                aiTestStatus === "testing" ? "rgba(148, 163, 184, 0.1)" :
                "rgba(239, 68, 68, 0.1)",
              color: 
                aiTestStatus === "success" ? "#22c55e" :
                aiTestStatus === "warning" ? "#f59e0b" :
                aiTestStatus === "testing" ? "var(--color-text-muted)" :
                "#ef4444",
            }}>
              {aiTestStatus === "testing" ? (
                <div style={{ width: "12px", height: "12px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              ) : (
                <span style={{ fontSize: "16px" }}>
                  {aiTestStatus === "success" ? "✅" : aiTestStatus === "warning" ? "⚠️" : "❌"}
                </span>
              )}
              {aiTestMessage}
            </div>
          )}
        </div>

        {/* 1. Theory Selection */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>1. 기본 해석 이론 선택</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-4)" }}>해석에 적용하고자 하는 심리상담 이론을 모두 선택하세요.</p>
          <div className={styles.theoryGrid}>
            {(Object.keys(THEORY_LABELS) as CounselingTheory[]).map((theory) => {
              const isSelected = localData.selectedTheories.includes(theory);
              return (
                <div
                  key={theory}
                  className={`${styles.theoryCard} ${isSelected ? styles.theoryCardActive : ""}`}
                  onClick={() => toggleTheory(theory)}
                >
                  <div className={styles.theoryHeader}>
                    <div className={`${styles.theoryCheck} ${isSelected ? styles.theoryCheckActive : ""}`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className={styles.theoryTitle}>{THEORY_LABELS[theory]}</span>
                  </div>
                  <p className={styles.theoryDesc}>{THEORY_DESCRIPTIONS[theory]}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Directionality */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>2. 사례 개념화 및 분석 방향</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-3)" }}>
            인공지능이 슈퍼비전 리포트를 작성할 때 특별히 중점을 두어야 할 방향성을 입력하세요.
          </p>
          <textarea
            className="form-textarea"
            placeholder="예) 내담자의 대인관계 패턴 중 투사적 동일시를 중점적으로 파악해 줘"
            value={localData.direction}
            onChange={(e) => setLocalData({ ...localData, direction: e.target.value })}
            style={{ minHeight: "120px" }}
          />
        </div>

        {/* 3. Transcript Summary Direction */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>3. 축어록 요약 방향</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-3)" }}>
            축어록(상담 대화 기록)을 요약할 때 AI가 중점을 두어야 할 방향을 입력하세요.
          </p>
          <textarea
            className="form-textarea"
            placeholder="예) 내담자의 감정 표현에 초점을 맞추고, 상담자의 반영 기법 사용을 분석해 줘"
            value={localData.transcriptDirection}
            onChange={(e) => setLocalData({ ...localData, transcriptDirection: e.target.value })}
            style={{ minHeight: "100px" }}
          />
        </div>

        {/* 4. Custom Prompt */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>4. 커스텀 지시사항 (선택사항)</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-3)" }}>
            슈퍼바이저로서 AI에게 전달할 추가 규칙이 있다면 자유롭게 적어주세요.
          </p>
          <textarea
            className="form-textarea"
            placeholder="예) 모든 해석은 단정짓지 말고 가설 형태로 부드럽게 제시할 것."
            value={localData.customPrompt}
            onChange={(e) => setLocalData({ ...localData, customPrompt: e.target.value })}
            style={{ minHeight: "80px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", justifyContent: "flex-end" }}>
          {savedMessage && <span style={{ color: "var(--color-primary)", fontSize: "14px", fontWeight: 500 }}>✓ 안전하게 저장되었습니다!</span>}
          <button className="btn btn-primary" onClick={handleSave}>설정 저장하기</button>
        </div>
      </div>
    </div>
  );
}
