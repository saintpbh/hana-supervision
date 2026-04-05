"use client";

import { useState, useEffect, useRef } from "react";
import { transcribeAudio } from "@/lib/audioPipeline";
import { saveTranscript, generateTranscriptId, getAllTranscripts, deleteTranscript, TranscriptRecord } from "@/lib/transcriptStorage";

export default function TranscriptPage() {
  
  // State
  const [clientName, setClientName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [engine, setEngine] = useState<"gemini" | "whisper">("gemini");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [status, setStatus] = useState<"idle" | "uploading" | "transcribing" | "done" | "error">("idle");
  const [progressMsg, setProgressMsg] = useState("");
  
  const [history, setHistory] = useState<TranscriptRecord[]>([]);
  const [viewingRecord, setViewingRecord] = useState<TranscriptRecord | null>(null);

  // Counselor Voice Recording State
  const [counselorAudio, setCounselorAudio] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    const records = await getAllTranscripts();
    setHistory(records);
  };

  // Load Instructions and History
  useEffect(() => {
    setSessionDate(new Date().toISOString().split("T")[0]);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const savedInst = localStorage.getItem("hana_transcript_inst");
    if (savedInst) {
      setInstructions(savedInst);
    }
    
    loadHistory();
  }, []);

  // Autosave instructions
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem("hana_transcript_inst", instructions);
    }, 500);
    return () => clearTimeout(timeout);
  }, [instructions]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use standard webm for max browser compatibility, or fallback
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'; 
      }
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setCounselorAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("마이크 접근 권한을 허용해주세요. (https 환경 필수)");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return alert("오디오 파일을 선택해주세요.");
    if (!clientName) return alert("내담자명을 입력해주세요.");
    if (!sessionDate) return alert("상담 일자를 선택해주세요.");

    const keysStr = localStorage.getItem("hana_ai_instructions");
    if (!keysStr) return alert("설정 메뉴에서 API 키를 먼저 등록해주세요.");
    const parsed = JSON.parse(keysStr);
    
    const apiKey = engine === "gemini" ? parsed.apiKey : parsed.openaiApiKey;
    if (!apiKey) return alert(`${engine === "gemini" ? "Gemini" : "OpenAI"} API 키가 설정에 등록되어 있지 않습니다.`);

    setStatus("uploading");
    setProgressMsg("작업 준비 중...");

    try {
      const text = await transcribeAudio({
        apiKey,
        file,
        counselorAudio: engine === "gemini" ? counselorAudio : null,
        instructions,
        engine,
        onProgress: (msg) => {
          setProgressMsg(msg);
          if (msg.includes("분석")) setStatus("transcribing");
        }
      });

      const record: TranscriptRecord = {
        id: generateTranscriptId(),
        clientName,
        sessionDate,
        content: text,
        createdAt: Date.now(),
        engine
      };

      await saveTranscript(record);
      setStatus("done");
      setProgressMsg("");
      setFile(null);
      setCounselorAudio(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      await loadHistory();
      setViewingRecord(record);

    } catch (err: unknown) {
      console.error(err);
      setStatus("error");
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setProgressMsg(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 축어록을 삭제하시겠습니까?")) return;
    await deleteTranscript(id);
    if (viewingRecord?.id === id) setViewingRecord(null);
    await loadHistory();
  };

  const currentStep = () => {
    if (status === "idle" || status === "error" || status === "done") return 0;
    if (status === "uploading") return 1;
    if (status === "transcribing") return 2;
    return 0;
  };

  return (
    <div style={{
      minHeight: "100%", width: "100%", padding: "var(--space-6)", color: "#e2e8f0",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      borderRadius: "16px",
      position: "relative"
    }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(168, 85, 247, 0); }
          100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        .mic-active {
          animation: pulse-ring 2s infinite cubic-bezier(0.25, 1, 0.5, 1);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          border-radius: 16px;
        }
        .engine-card {
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .engine-card.gemini-active {
          border-color: #a855f7;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.2), inset 0 0 20px rgba(168, 85, 247, 0.1);
        }
        .engine-card.whisper-active {
          border-color: #06b6d4;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.2), inset 0 0 20px rgba(6, 182, 212, 0.1);
        }
        .history-item {
          transition: all 0.2s ease;
        }
        .history-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          transform: translateY(-2px);
        }
        .premium-input {
          background: rgba(0, 0, 0, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          transition: border-color 0.2s;
        }
        .premium-input:focus {
          border-color: rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.05) !important;
        }
      `}</style>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "32px", alignItems: "flex-start" }}>
        
        {/* Left Column: Form */}
        <div className="glass-card" style={{ flex: "1 1 65%", display: "flex", flexDirection: "column", gap: "24px", padding: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 8px 0", background: "linear-gradient(to right, #fff, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              음성 축어록 변환
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0 }}>
              상담 녹음 파일을 화자가 분리된 깔끔한 축어록으로 변환하세요.
            </p>
          </div>

          <div style={{ display: "flex", gap: "24px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "8px" }}>내담자 이름</label>
              <input type="text" className="input-text premium-input" placeholder="예: 홍길동" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "8px" }}>상담 일자</label>
              <input type="date" className="input-text premium-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
            </div>
          </div>

          {/* Engine Selection */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "12px" }}>AI 모델 명</label>
            <div style={{ display: "flex", gap: "16px" }}>
              <label className={`engine-card ${engine === "gemini" ? "gemini-active" : ""}`} style={{ flex: 1, padding: "20px", borderRadius: "12px", border: "2px solid rgba(255,255,255,0.08)", background: engine === "gemini" ? "rgba(168, 85, 247, 0.05)" : "rgba(0,0,0,0.2)", cursor: "pointer" }}>
                <input type="radio" value="gemini" checked={engine === "gemini"} onChange={() => setEngine("gemini")} style={{ display: "none" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${engine === "gemini" ? "#a855f7" : "#475569"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {engine === "gemini" && <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#a855f7" }} />}
                  </div>
                  <span style={{ fontSize: "20px" }}>🧠</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: "16px", color: engine === "gemini" ? "#fff" : "#cbd5e1" }}>Gemini 2.5 Flash</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>무제한 용량 처리, 압도적 문맥 파악 구조</div>
              </label>

              <label className={`engine-card ${engine === "whisper" ? "whisper-active" : ""}`} style={{ flex: 1, padding: "20px", borderRadius: "12px", border: "2px solid rgba(255,255,255,0.08)", background: engine === "whisper" ? "rgba(6, 182, 212, 0.05)" : "rgba(0,0,0,0.2)", cursor: "pointer" }}>
                <input type="radio" value="whisper" checked={engine === "whisper"} onChange={() => setEngine("whisper")} style={{ display: "none" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${engine === "whisper" ? "#06b6d4" : "#475569"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {engine === "whisper" && <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#06b6d4" }} />}
                  </div>
                  <span style={{ fontSize: "20px" }}>🎙️</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: "16px", color: engine === "whisper" ? "#fff" : "#cbd5e1" }}>Whisper v3 <span className="badge badge-purple" style={{ fontSize: "10px", marginLeft: "4px" }}>PRO</span></div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>높은 정확도 (20MB 미만 짧은 대화용)</div>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px" }}>
            {/* Instructions */}
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "8px" }}>추가 요청 (지시사항)</label>
              <textarea
                className="form-textarea premium-input"
                placeholder="예시: 감정적인 침묵, 행동은 (울음) 처럼 괄호 안에 표기하세요."
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                style={{ minHeight: "140px", resize: "none" }}
              />
            </div>

            {/* Voice Registration */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "8px" }}>
                <span>상담사 목소리 프로필 등록 (화자 분리)</span>
                {engine === "whisper" && <span style={{ fontSize: "11px", color: "#ef4444" }}>*Whisper 모드 지원 불가</span>}
              </label>
              
              <div style={{ 
                flex: 1,
                background: engine === "whisper" ? "rgba(0,0,0,0.1)" : "linear-gradient(145deg, rgba(30,27,75,0.4) 0%, rgba(15,23,42,0.4) 100%)", 
                borderRadius: "12px", 
                border: "1px solid rgba(255,255,255,0.05)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: engine === "whisper" ? 0.3 : 1,
                pointerEvents: engine === "whisper" ? "none" : "auto",
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{ textAlign: "center", zIndex: 1 }}>
                  {!counselorAudio ? (
                    <>
                      <button 
                        type="button" 
                        onClick={isRecording ? stopRecording : startRecording}
                        className={isRecording ? "mic-active" : ""}
                        style={{ 
                          width: "64px", height: "64px", borderRadius: "50%", 
                          background: isRecording ? "linear-gradient(135deg, #a855f7, #ec4899)" : "rgba(255,255,255,0.05)",
                          border: isRecording ? "none" : "1px solid rgba(255,255,255,0.1)",
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", transition: "all 0.3s", margin: "0 auto 16px"
                        }}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill={isRecording ? "#fff" : "none"} stroke="currentColor" strokeWidth={isRecording ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                          <line x1="12" y1="19" x2="12" y2="22"></line>
                        </svg>
                      </button>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: isRecording ? "#f472b6" : "#cbd5e1" }}>
                        {isRecording ? "음성을 수집 중입니다..." : "내 목소리 데이터 저장"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>10초 내외의 인사말 텍스트를 읽어 주세요</div>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#10b981" }}>사전 분석이 완료되었습니다</div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <audio src={URL.createObjectURL(counselorAudio)} controls style={{ height: "24px", width: "120px", display: "none" }} />
                        <button type="button" onClick={() => setCounselorAudio(null)} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", padding: "4px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>초기화</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{}}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#cbd5e1", marginBottom: "8px" }}>대용량 오디오 첨부</label>
            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed rgba(255,255,255,0.2)", padding: "24px", borderRadius: "12px", textAlign: "center", position: "relative", transition: "all 0.2s" }}>
              <input
                type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileChange}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
              />
              <div style={{ pointerEvents: "none" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                {file ? (
                  <div>
                    <div style={{ fontWeight: 500, color: "#fff", fontSize: "14px" }}>{file.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 500, color: "#e2e8f0", fontSize: "14px" }}>직접 드래그 하거나 클릭을 해 폴더에서 선택하세요</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>mp3, m4a 등 확장자 지원 (최대 등록 용량: 20MB)</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {status !== "idle" && status !== "done" && (
            <div style={{ padding: "16px", background: status === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(168, 85, 247, 0.1)", borderRadius: "8px", border: status === "error" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(168, 85, 247, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: status !== "error" ? "12px" : 0 }}>
                {status !== "error" ? (
                  <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #a855f7", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
                ) : (
                  <span style={{ fontSize: "18px" }}>⚠️</span>
                )}
                <span style={{ fontWeight: 500, fontSize: "14px", color: status === "error" ? "#ef4444" : "#e2e8f0" }}>{progressMsg}</span>
              </div>
              {status !== "error" && (
                <div style={{ height: "4px", background: "rgba(0,0,0,0.3)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#a855f7", width: currentStep() === 1 ? "40%" : "80%", transition: "width 0.5s ease" }} />
                </div>
              )}
            </div>
          )}

          <button 
            className="btn btn-primary" 
            onClick={handleTranscribe} 
            disabled={!file || status === "uploading" || status === "transcribing" || (engine === "whisper" && file && file.size > 25 * 1024 * 1024)}
            style={{ width: "100%", height: "48px", fontSize: "15px", fontWeight: 600, background: "linear-gradient(to right, #7e22ce, #db2777)", border: "none", marginTop: "auto" }}
          >
            {status === "uploading" || status === "transcribing" ? "변환이 진행되고 있습니다..." : "음성 파일 분석 시작하기"}
          </button>
        </div>

        {/* Right Column: History */}
        <div style={{ flex: "1 1 35%", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 16px 0", color: "#f8fafc" }}>기존 저장 내역</h2>
          </div>
          
          {viewingRecord ? (
            <div className="glass-card" style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "16px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#fff" }}>{viewingRecord.clientName}</h3>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>{viewingRecord.sessionDate} • {viewingRecord.engine}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={async () => {
                      if (!viewingRecord) return;
                      await saveTranscript(viewingRecord);
                      await loadHistory();
                      alert("수정사항이 저장되었습니다.");
                    }}
                    style={{ background: "rgba(168, 85, 247, 0.2)", border: "1px solid rgba(168, 85, 247, 0.4)", color: "#d8b4fe", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                  >수정사항 저장</button>
                  <button onClick={() => {
                      const blob = new Blob([viewingRecord.content], { type: "text/plain;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `축어록_${viewingRecord.clientName}_${viewingRecord.sessionDate}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(a.href);
                    }}
                    style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                  >TXT 다운로드</button>
                  <button onClick={() => {
                      let csv = "\uFEFF"; // BOM for Excel UTF-8
                      csv += "화자구분,번호,구분,내용\n";
                      const lines = viewingRecord.content.split('\n');
                      for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        const match = trimmed.match(/^([a-zA-Z가-힣]+)\s*(\d*)\s*[:：]\s*(.*)$/);
                        if (match) {
                          const roleStr = match[1].trim();
                          const numStr = match[2].trim();
                          const text = `"${match[3].replace(/"/g, '""')}"`;
                          csv += `"${roleStr}","${numStr}",":",${text}\n`;
                        } else {
                          csv += `"","","",` + `"${trimmed.replace(/"/g, '""')}"` + "\n";
                        }
                      }
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `축어록_${viewingRecord.clientName}_${viewingRecord.sessionDate}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(a.href);
                    }}
                    style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                  >엑셀(CSV) 다운로드</button>
                  <button onClick={() => handleDelete(viewingRecord.id)}
                    style={{ background: "transparent", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#ef4444", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", marginLeft: "4px" }}
                  >삭제</button>
                </div>
              </div>
              
              <textarea 
                value={viewingRecord.content}
                onChange={(e) => setViewingRecord({ ...viewingRecord, content: e.target.value })}
                style={{ flex: 1, width: "100%", resize: "none", overflowY: "auto", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "16px", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap", border: "1px solid rgba(255,255,255,0.03)", outline: "none", fontFamily: "inherit" }}
              />
              <button 
                onClick={() => setViewingRecord(null)}
                style={{ marginTop: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
              >← 히스토리 목록 되돌아가기</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {history.length === 0 ? (
                <div className="glass-card" style={{ padding: "40px 24px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                  아직 생성된 축어록 파일이 존재하지 않습니다.
                </div>
              ) : (
                history.map(record => (
                  <div key={record.id} className="glass-card history-item" onClick={() => setViewingRecord(record)} style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      </div>
                      <div>
                        <div style={{ color: "#f8fafc", fontWeight: 500, fontSize: "14px", marginBottom: "4px" }}>{record.clientName}_{record.sessionDate}.txt</div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px", color: "#64748b" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: "10px" }}>
                            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#10b981" }} /> 열람 가능
                          </span>
                          <span>{record.engine}</span>
                        </div>
                      </div>
                    </div>
                    <button style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", border: "none", color: "#fff", padding: "6px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      상세 데이터 읽기
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
