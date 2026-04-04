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
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <div style={{ width: "120px", fontWeight: 500, fontSize: "14px" }}>ChatGPT</div>
              <input
                type="password"
                className="input-text"
                placeholder="sk-proj-..."
                value={localData.openaiApiKey || ""}
                onChange={(e) => setLocalData({ ...localData, openaiApiKey: e.target.value })}
                style={{ flex: 1, padding: "var(--space-2) var(--space-3)", fontSize: "14px", fontFamily: "monospace" }}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <div style={{ width: "120px", fontWeight: 500, fontSize: "14px" }}>Claude</div>
              <input
                type="password"
                className="input-text"
                placeholder="sk-ant-..."
                value={localData.anthropicApiKey || ""}
                onChange={(e) => setLocalData({ ...localData, anthropicApiKey: e.target.value })}
                style={{ flex: 1, padding: "var(--space-2) var(--space-3)", fontSize: "14px", fontFamily: "monospace" }}
              />
            </div>
          </div>
          
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "var(--space-6)", marginBottom: "var(--space-4)" }}>AI 런타임 모드 선택</h2>
          
          <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: localData.orchestrationMode === "single" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: localData.orchestrationMode === "single" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
              <input type="radio" name="orchestrationMode" value="single" checked={localData.orchestrationMode === "single"} onChange={() => setLocalData({ ...localData, orchestrationMode: "single" })} />
              <div>
                <div style={{ fontWeight: 600 }}>단일 모델 모드 (Single Model)</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>선택한 하나의 모델이 데이터 분석, 진단, 작성을 모두 처리합니다.</div>
              </div>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: localData.orchestrationMode === "multi" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: localData.orchestrationMode === "multi" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
              <input type="radio" name="orchestrationMode" value="multi" checked={localData.orchestrationMode === "multi"} onChange={() => setLocalData({ ...localData, orchestrationMode: "multi" })} />
              <div>
                <div style={{ fontWeight: 600 }}>멀티 에이전트 모드 (Multi-Agent) <span className="badge badge-purple" style={{ fontSize: "10px" }}>PRO</span></div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Gemini, ChatGPT, Claude가 협력하여 고품질의 심층 보고서를 작성합니다.</div>
              </div>
            </label>
          </div>

          {localData.orchestrationMode === "single" && (
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
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro (최상위/실험)</option>
                  <option value="gemini-3-flash-preview">gemini-3-flash (최신/강력함)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (권장)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (안정/빠름)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (안정/고성능)</option>
                </optgroup>
                <optgroup label="OpenAI ChatGPT">
                  <option value="gpt-4o">gpt-4o (강력함)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (빠름)</option>
                </optgroup>
                <optgroup label="Anthropic Claude">
                  <option value="claude-3-7-sonnet-20250219">claude-3.7-sonnet (최신/뛰어남)</option>
                  <option value="claude-3-5-sonnet-20241022">claude-3.5-sonnet (권장)</option>
                  <option value="claude-3-5-haiku-20241022">claude-3.5-haiku (빠름)</option>
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

          {localData.orchestrationMode === "multi" && (
            <div style={{ backgroundColor: "rgba(0, 0, 0, 0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "var(--space-3)", color: "var(--color-secondary)" }}>멀티 에이전트 협력 파이프라인 안내</h3>
              <ul style={{ fontSize: "13px", color: "var(--color-text)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <li><strong>1단계 (Data Parser):</strong> <span style={{ color: "var(--color-primary)" }}>Gemini-2.0-flash</span>가 원본 문서와 심리검사를 빠르게 분석합니다.</li>
                <li><strong>2단계 (Diagnostician):</strong> <span style={{ color: "#10a37f" }}>GPT-4o</span>가 1단계 결과를 바탕으로 철저한 임상 진단을 수행합니다.</li>
                <li><strong>3단계 (Synthesizer):</strong> <span style={{ color: "#d97757" }}>Claude-3.5-Sonnet</span>이 진단 결과를 토대로 최종 공감형 보고서를 서술합니다.</li>
              </ul>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
                *주의: 3사의 API Key가 모두 입력되어 있어야 정상 작동합니다.
              </div>
            </div>
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
