import { GoogleGenerativeAI } from "@google/generative-ai";

interface TranscribeOptions {
  apiKey: string;
  file: File;
  instructions: string;
  engine: "gemini" | "whisper";
  onProgress?: (msg: string) => void;
}

export async function transcribeAudio({ apiKey, file, instructions, engine, onProgress }: TranscribeOptions): Promise<string> {
  if (engine === "whisper") {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("Whisper API는 25MB 이하의 오디오 파일만 지원합니다.");
    }
    onProgress?.("Whisper API로 전송 중...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");
    // prompt param for whisper helps with diarization formatting or specific syntax
    const systemPrompt = `다음 지침을 반드시 준수하여 축어록을 작성하세요:\n1. 화자를 '상1', '내1'로 분리할 것.\n2. 침묵이나 대답이 없는 구간은 '(...)'로 표기할 것.\n3. 커스텀 지침: ${instructions}`;
    formData.append("prompt", systemPrompt);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || "Whisper 변환에 실패했습니다.");
    }

    const data = await res.json();
    return data.text;
  } 
  
  if (engine === "gemini") {
    // 1. Upload to Gemini File API manually via REST since GoogleAIFileManager is Node-only
    onProgress?.("Gemini 서버로 오디오 파일 업로드 중 (최대 2GB)...");
    
    // First, init resumable upload
    const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${apiKey}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": file.size.toString(),
        "X-Goog-Upload-Header-Content-Type": file.type,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ file: { display_name: file.name } })
    });

    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error("Gemini 업로드 초기화 실패: " + (err.error?.message || "알 수 없는 에러"));
    }

    const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) throw new Error("업로드 URL을 찾을 수 없습니다.");

    // Upload bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": file.size.toString(),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: file
    });

    if (!uploadRes.ok) throw new Error("오디오 본문 업로드에 실패했습니다.");
    const fileInfo = await uploadRes.json();
    const fileUri = fileInfo.file.uri;

    onProgress?.("업로드 완료! 축어록 분석 및 변환 중 (수 분의 시간이 소요될 수 있습니다)...");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // best for transcription

    const systemPrompt = `당신은 전문 심리상담 축어록 속기사입니다. 첨부된 상담 오디오를 처음부터 끝까지 빠짐없이 들어보고 매우 정확한 텍스트 축어록을 작성하세요.
    - 화자는 반드시 상담사는 "상1:", 내담자는 "내1:" 로 표기하세요.
    - 화자가 중간에 침묵하거나 대화가 비는 구간(3초 이상)은 반드시 "(...)" 로 표기하세요.
    - 아래 추가 지침을 반드시 준수하세요:
    ${instructions}`;

    const result = await model.generateContent([
      systemPrompt,
      { fileData: { fileUri: fileUri, mimeType: fileInfo.file.mimeType } }
    ]);

    return result.response.text();
  }

  throw new Error("지원하지 않는 엔진입니다.");
}
