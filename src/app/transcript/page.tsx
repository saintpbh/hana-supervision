"use client";

import { useState, useEffect, useRef } from "react";
import { transcribeAudio } from "@/lib/audioPipeline";
import { saveTranscript, generateTranscriptId, getAllTranscripts, deleteTranscript, TranscriptRecord } from "@/lib/transcriptStorage";

export default function TranscriptPage() {
  
  // State
  const [clientName, setClientName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
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
    const savedInst = localStorage.getItem("hana_transcript_inst");
    if (savedInst) setInstructions(savedInst);
    
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
    <div className="page-container" style={{ display: "flex", gap: "var(--space-6)" }}>
      {/* Left Column: Form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div className="card">
          <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "var(--space-2)" }}>음성 축어록 변환</h1>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
            상담 오디오를 업로드하면 자동으로 상담사(상1)/내담자(내1)로 분류된 축어록을 생성합니다.
          </p>

          <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">내담자명 (가명)</label>
              <input type="text" className="input-text" placeholder="예: 홍길동" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">상담 일자</label>
              <input type="date" className="input-text" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <label className="form-label">엔진 및 품질 옵션 선택</label>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <label style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: engine === "gemini" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: engine === "gemini" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
                <input type="radio" name="engine" value="gemini" checked={engine === "gemini"} onChange={() => setEngine("gemini")} />
                <div>
                  <div style={{ fontWeight: 600 }}>일반 축어록 (Gemini 2.5 Flash)</div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>1시간 기준 약 100원. 파일 용량 제한 없음. 빠르고 무난한 성능.</div>
                </div>
              </label>
              <label style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", background: engine === "whisper" ? "rgba(255, 255, 255, 0.1)" : "transparent", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: engine === "whisper" ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
                <input type="radio" name="engine" value="whisper" checked={engine === "whisper"} onChange={() => setEngine("whisper")} />
                <div>
                  <div style={{ fontWeight: 600 }}>고품질 축어록 (OpenAI Whisper) <span className="badge badge-purple" style={{ fontSize: "10px" }}>PRO</span></div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>1시간 기준 약 500원. 최상급 품질. 단, 25MB 이하 파일만 업로드 가능 (m4a, mp3 권장).</div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <label className="form-label">
              축어록 변환 지침 (자동 저장)
            </label>
            <textarea
              className="form-textarea"
              placeholder="예) 내담자가 울먹이는 부분은 괄호로 [울먹임] 표시해줘. 특정 억양을 최대한 살려줘."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              style={{ minHeight: "100px" }}
            />
          </div>

          {/* Counselor Voice Registration (Optional) */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>상담사 목소리 식별 등록 (선택)</span>
              {engine === "whisper" && <span style={{ fontSize: "12px", color: "var(--color-error)", fontWeight: "normal" }}>Whisper 엔진은 미지원</span>}
            </label>
            <div style={{ 
              background: engine === "whisper" ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", 
              padding: "var(--space-4)", 
              borderRadius: "var(--radius-lg)", 
              border: "1px solid var(--color-border)",
              opacity: engine === "whisper" ? 0.5 : 1,
              pointerEvents: engine === "whisper" ? "none" : "auto"
            }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
                AI가 상담사 역할을 더 정확히 분류(Diarization)할 수 있도록 목소리 샘플을 남겨주세요. 아래 문장을 읽어주세요:<br/>
                <strong style={{ color: "var(--color-text)", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: "4px", display: "inline-block", marginTop: "8px" }}>
                  &quot;안녕하세요, 저는 오늘 상담을 진행할 상담사입니다. 편안한 마음으로 이야기해 주시면 감사하겠습니다.&quot;
                </strong>
              </p>
              
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {!isRecording ? (
                  <button type="button" className="btn btn-outline" onClick={startRecording} style={{ borderColor: 'var(--color-border)' }}>
                    🎙️ 녹음 시작
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={stopRecording} style={{ background: "var(--color-error)", borderColor: "var(--color-error)" }}>
                    ⏹ 녹음 정지 (녹음 중...)
                  </button>
                )}
                
                {counselorAudio && !isRecording && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "rgba(0,0,0,0.3)", padding: "4px 12px", borderRadius: "20px" }}>
                    <span style={{ fontSize: "16px" }}>✅</span>
                    <audio 
                      src={URL.createObjectURL(counselorAudio)} 
                      controls 
                      style={{ height: "30px", width: "200px" }}
                    />
                    <button type="button" style={{ background: "none", border: "none", color: "var(--color-error)", cursor: "pointer", marginLeft: "4px", fontSize: "12px", opacity: 0.8 }} onClick={() => setCounselorAudio(null)}>
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <label className="form-label">오디오 파일 업로드</label>
            <div style={{ border: "2px dashed var(--color-border)", padding: "var(--space-6)", borderRadius: "var(--radius-lg)", textAlign: "center", position: "relative" }}>
              <input
                type="file"
                accept="audio/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
              />
              <div style={{ pointerEvents: "none" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto var(--space-3)" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                {file ? (
                  <div>
                    <div style={{ fontWeight: 600 }}>{file.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                      {engine === "whisper" && file.size > 25 * 1024 * 1024 && (
                        <span style={{ color: "var(--color-error)", display: "block", marginTop: "4px" }}>
                          ⚠️ Whisper 제한 25MB를 초과했습니다. Gemini 엔진을 선택하거나 파일을 압축하세요.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 500 }}>클릭하거나 파일을 여기로 드래그하세요</div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>MP3, M4A, WAV 등 지원</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {status !== "idle" && status !== "done" && (
            <div style={{ marginBottom: "var(--space-6)", padding: "var(--space-4)", backgroundColor: status === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)", border: status === "error" ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: status !== "error" ? "var(--space-3)" : 0 }}>
                {status !== "error" ? (
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: "2px solid var(--color-primary)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
                ) : (
                  <span style={{ color: "var(--color-error)", fontSize: "20px" }}>⚠️</span>
                )}
                <span style={{ fontWeight: 500, color: status === "error" ? "var(--color-error)" : "inherit" }}>{progressMsg}</span>
              </div>
              
              {status !== "error" && (
                <div style={{ height: "4px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--color-primary)", width: currentStep() === 1 ? "40%" : "80%", transition: "width 0.5s ease" }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button 
              className="btn btn-primary" 
              onClick={handleTranscribe} 
              disabled={!file || status === "uploading" || status === "transcribing" || (engine === "whisper" && file && file.size > 25 * 1024 * 1024)}
              style={{ width: "100%" }}
            >
              축어록 변환 시작
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Preview / History */}
      <div style={{ width: "450px", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {viewingRecord ? (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <div>
                <h3 style={{ fontWeight: 700 }}>{viewingRecord.clientName} ({viewingRecord.sessionDate})</h3>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Engine: {viewingRecord.engine}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                  onClick={() => {
                    const blob = new Blob([viewingRecord.content], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `축어록_${viewingRecord.clientName}_${viewingRecord.sessionDate}.txt`;
                    a.click();
                  }}
                >
                  다운로드
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: "4px 8px", fontSize: "12px", color: "var(--color-error)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  onClick={() => handleDelete(viewingRecord.id)}
                >
                  삭제
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", background: "rgba(0, 0, 0, 0.2)", padding: "var(--space-4)", borderRadius: "var(--radius-md)", fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap", border: "1px solid var(--color-border)" }}>
              {viewingRecord.content}
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: "var(--space-4)" }}
              onClick={() => setViewingRecord(null)}
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>변환 기록 (최근순)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {history.length === 0 ? (
                <div style={{ color: "var(--color-text-muted)", fontSize: "14px", textAlign: "center", padding: "var(--space-6) 0" }}>
                  저장된 축어록 내역이 없습니다.
                </div>
              ) : (
                history.map(record => (
                  <div 
                    key={record.id} 
                    style={{ padding: "var(--space-3)", background: "rgba(255, 255, 255, 0.05)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                    onClick={() => setViewingRecord(record)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{record.clientName}</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {record.sessionDate} • {record.engine}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
