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
          <p className="form-hint" style={{ marginBottom: "var(--space-4)" }}>
            사용하고자 하는 AI 모델에 맞게 API 키를 입력하세요. (Gemini는 비워둘 시 기본 제공 키 적용)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <div style={{ width: "120px", fontWeight: 500, fontSize: "14px" }}>Google Gemini</div>
              <input
                type="password"
                className="input-text"
                placeholder="AIzaSy..."
                value={localData.apiKey || ""}
                onChange={(e) => setLocalData({ ...localData, apiKey: e.target.value })}
                style={{ flex: 1, padding: "var(--space-2) var(--space-3)", fontSize: "14px", fontFamily: "monospace" }}
              />
            </div>
          </div>
          
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "var(--space-6)", marginBottom: "var(--space-4)" }}>AI 런타임 모드 선택</h2>
          
          <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: localData.orchestrationMode === "single" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: localData.orchestrationMode === "single" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
              <input type="radio" name="orchestrationMode" value="single" checked={localData.orchestrationMode === "single"} onChange={() => setLocalData({ ...localData, orchestrationMode: "single" })} />
              <div>
                <div style={{ fontWeight: 600 }}>단일 모델 처리</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>선택한 Gemini 모델 하나가 분석부터 작성, 검증까지 모두 처리합니다.</div>
              </div>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: localData.orchestrationMode === "gemini-multi" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: localData.orchestrationMode === "gemini-multi" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
              <input type="radio" name="orchestrationMode" value="gemini-multi" checked={localData.orchestrationMode === "gemini-multi"} onChange={() => setLocalData({ ...localData, orchestrationMode: "gemini-multi" })} />
              <div>
                <div style={{ fontWeight: 600 }}>Gemini 서브 에이전트 파이프라인 <span className="badge badge-blue" style={{ fontSize: "10px", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", padding: "2px 6px", borderRadius: "4px", marginLeft: "4px" }}>권장</span></div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>최상위 모델이 문서를 작성하고, 초고속 모델(Flash)이 가혹한 QA 검증을 전담하는 효율적 구조입니다.</div>
              </div>
            </label>
          </div>

          {(localData.orchestrationMode === "single" || localData.orchestrationMode === "gemini-multi") && (
            <>
              <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>모델 선택 및 테스트</h2>
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "250px" }}>
              <select
                className="input-text"
                value={localData.model || "gemini-2.0-flash"}
                onChange={(e) => setLocalData({ ...localData, model: e.target.value })}
                style={{ width: "100%", padding: "var(--space-2) var(--space-3)", fontSize: "14px", height: "100%", cursor: "pointer", backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <optgroup label="Google Gemini">
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro (최상위/실험적)</option>
                  <option value="gemini-3-flash-preview">gemini-3-flash (최신/강력함)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (최상위 성능)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (권장/가성비)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (매우 빠름)</option>
                </optgroup>
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
                      openaiApiKey: localData.openaiApiKey,
                      anthropicApiKey: localData.anthropicApiKey,
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
            </>
          )}

        </div>

        {/* 0. Role and Persona */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>0. 인공지능 역할 및 퍼소나 (Role & Persona)</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-3)" }}>인공지능이 갖추어야 할 전문가로서의 정체성과 역할을 정의하세요.</p>
          <textarea
            className="form-textarea"
            value={localData.rolePersona || ""}
            onChange={(e) => setLocalData({ ...localData, rolePersona: e.target.value })}
            style={{ minHeight: "60px" }}
          />
        </div>

        {/* 1. Theory Selection */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>1. 기본 해석 이론 (편집 가능)</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-4)" }}>해석에 적용하고자 하는 심리상담 이론을 입력하세요.</p>
          <textarea
            className="form-textarea"
            value={localData.counselingTheory || ""}
            onChange={(e) => setLocalData({ ...localData, counselingTheory: e.target.value })}
            style={{ minHeight: "80px" }}
          />
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

        {/* 4. Report Style Level */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>4. 보고서 작성 스타일</h2>
          <p className="form-hint" style={{ marginBottom: "var(--space-4)" }}>
            최종 보고서의 학술적 깊이를 조절합니다. 슈퍼비전 제출용 사례보고서부터 학술 논문 수준까지 선택할 수 있습니다.
          </p>

          {(() => {
            const levels = [
              { level: 1 as const, label: "실무 사례보고서", emoji: "📋", desc: "슈퍼비전 제출용. 간결하고 명료한 실무 양식. 학술 인용 최소화, 사례개념화 중심." },
              { level: 2 as const, label: "사례 중심 분석", emoji: "📝", desc: "사례보고서 기반이지만, 주요 판단에 간략한 이론적 근거(1~2줄)를 병기합니다." },
              { level: 3 as const, label: "균형 보고서", emoji: "⚖️", desc: "실무적 구조를 유지하면서 각 섹션에 학술적 해석 문단을 병행합니다." },
              { level: 4 as const, label: "심층 분석 보고서", emoji: "🔬", desc: "학술적 깊이 강화. 교차분석, 방어기제 논의 등 전공서적 수준의 해설을 포함합니다." },
              { level: 5 as const, label: "학술 논문 수준", emoji: "🎓", desc: "박사 논문급 분량과 깊이. [Ref:] 인용 표기를 전면 적용한 학술적 보고서." },
            ];
            const currentLevel = localData.reportStyleLevel || 3;
            const currentInfo = levels.find(l => l.level === currentLevel) || levels[2];

            return (
              <div>
                {/* Slider track */}
                <div style={{ position: "relative", padding: "var(--space-4) 0" }}>
                  {/* Background track */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "10%",
                    right: "10%",
                    height: "4px",
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: "2px",
                    transform: "translateY(-50%)",
                  }} />
                  {/* Active track */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "10%",
                    width: `${((currentLevel - 1) / 4) * 80}%`,
                    height: "4px",
                    background: "linear-gradient(90deg, #22c55e, #3b82f6, #a855f7)",
                    borderRadius: "2px",
                    transform: "translateY(-50%)",
                    transition: "width 0.3s ease",
                  }} />

                  {/* Step circles */}
                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "0 10%" }}>
                    {levels.map((l) => {
                      const isActive = l.level === currentLevel;
                      const isPast = l.level < currentLevel;
                      return (
                        <button
                          key={l.level}
                          onClick={() => setLocalData({ ...localData, reportStyleLevel: l.level })}
                          style={{
                            width: isActive ? "44px" : "36px",
                            height: isActive ? "44px" : "36px",
                            borderRadius: "50%",
                            border: isActive ? "2px solid var(--color-primary)" : isPast ? "2px solid rgba(168, 85, 247, 0.4)" : "2px solid rgba(255,255,255,0.15)",
                            background: isActive
                              ? "linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.3))"
                              : isPast
                                ? "rgba(168, 85, 247, 0.1)"
                                : "rgba(255,255,255,0.05)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isActive ? "18px" : "14px",
                            transition: "all 0.25s ease",
                            transform: isActive ? "scale(1.1)" : "scale(1)",
                            boxShadow: isActive ? "0 0 16px rgba(168, 85, 247, 0.3)" : "none",
                          }}
                          title={l.label}
                        >
                          {l.emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Level labels below */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-1) 5% 0", marginTop: "var(--space-1)" }}>
                  {levels.map((l) => (
                    <div
                      key={l.level}
                      onClick={() => setLocalData({ ...localData, reportStyleLevel: l.level })}
                      style={{
                        textAlign: "center",
                        width: "20%",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: l.level === currentLevel ? 700 : 400,
                        color: l.level === currentLevel ? "var(--color-primary)" : "var(--color-text-muted)",
                        transition: "all 0.2s ease",
                        lineHeight: "1.3",
                      }}
                    >
                      {l.label}
                    </div>
                  ))}
                </div>

                {/* Current selection detail card */}
                <div style={{
                  marginTop: "var(--space-5)",
                  padding: "var(--space-4)",
                  background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(59, 130, 246, 0.06))",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-3)",
                }}>
                  <span style={{ fontSize: "24px", flexShrink: 0 }}>{currentInfo.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-primary)", marginBottom: "4px" }}>
                      Lv.{currentLevel} — {currentInfo.label}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-muted)", lineHeight: "1.6" }}>
                      {currentInfo.desc}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 5. Custom Prompt */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>5. 커스텀 지시사항 (선택사항)</h2>
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
