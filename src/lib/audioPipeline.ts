import { GoogleGenerativeAI, Part } from "@google/generative-ai";

interface TranscribeOptions {
  apiKey: string;
  file: File;
  counselorAudio?: Blob | null;
  instructions: string;
  engine: "gemini" | "whisper";
  onProgress?: (msg: string) => void;
}

export async function transcribeAudio({ apiKey, file, counselorAudio, instructions, engine, onProgress }: TranscribeOptions): Promise<string> {
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
    let mainAudioPart: Part;

    if (file.size > 19 * 1024 * 1024) {
      // 대용량 파일: Gemini File API (Multipart Upload) 직접 사용
      onProgress?.(`Gemini 서버로 대용량 파일 전송 시작... (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      
      const boundary = "------HanaFormBoundary" + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({ file: { display_name: file.name } });
      
      const blob = new Blob([
        `--${boundary}\r\n`,
        `Content-Type: application/json\r\n\r\n`,
        `${metadata}\r\n`,
        `--${boundary}\r\n`,
        `Content-Type: ${file.type}\r\n\r\n`,
        file,
        `\r\n--${boundary}--\r\n`
      ]);

      const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "multipart",
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: blob
      });

      if (!uploadRes.ok) {
        const errTxt = await uploadRes.text();
        throw new Error("대용량 업로드 실패: " + errTxt);
      }

      const uploadData = await uploadRes.json();
      const fileUri = uploadData.file.uri;
      const fileName = uploadData.file.name; // e.g. "files/xyz"

      onProgress?.("업로드 완료. 오디오 데이터 처리 대기 중...");
      let state = uploadData.file.state;
      while (state === "PROCESSING") {
        await new Promise(r => setTimeout(r, 3000));
        const statRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
        if (!statRes.ok) break; 
        const statData = await statRes.json();
        state = statData.state;
        if (state === "FAILED") throw new Error("서버에서 오디오/비디오 처리에 실패했습니다.");
      }

      mainAudioPart = { fileData: { fileUri, mimeType: file.type } };

    } else {
      // 소용량 파일: Base64 인라인 전송
      onProgress?.("오디오 압축 및 프롬프트 준비 중...");
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      mainAudioPart = { inlineData: { data: base64Data, mimeType: file.type } };
    }

    // Convert counselor sample audio if exists
    let counselorBase64 = null;
    let counselorMimeType = "";
    if (counselorAudio) {
      counselorBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(counselorAudio);
      });
      counselorMimeType = counselorAudio.type;
    }

    onProgress?.("Gemini 서버로 분석 요청 및 변환 중 (수 분이 소요될 수 있습니다)...");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

    let systemPrompt = `당신은 전문 심리상담 축어록 속기사입니다. 첨부된 상담 오디오를 처음부터 끝까지 빠짐없이 들어보고 매우 정확한 텍스트 축어록을 작성하세요.
    - 화자는 반드시 상담사는 "상1:", 내담자는 "내1:" 로 표기하세요.
    - 화자가 중간에 침묵하거나 대화가 비는 구간(3초 이상)은 반드시 "(...)" 로 표기하세요.
    - 아래 추가 지침을 반드시 준수하세요:
    ${instructions}`;

    const parts: Part[] = [];
    
    // If we have counselor sample, instruct the AI
    if (counselorBase64) {
      systemPrompt = `당신은 전문 심리상담 축어록 속기사입니다. 두 개의 오디오 파일이 차례로 제공됩니다.
첫 번째 오디오 파일은 '상담사(상1)' 본인의 목소리 기준 샘플 파일입니다. 
두 번째 오디오 파일이 실제 상담 본편입니다.
반드시 첫 번째 샘플 오디오 파일의 목소리를 기준으로, 본 상담 오디오 파일 내의 화자를 구분(Diarization)하여 매우 정확한 텍스트 축어록을 작성하세요.
- 첫번째 목소리와 일치하는 화자는 "상1:", 다른 화자는 "내1:" 로 표기하세요.
- 화자가 중간에 침묵하거나 대화가 비는 구간(3초 이상)은 반드시 "(...)" 로 표기하세요.
- 추가 지침:
${instructions}`;
      parts.push({ inlineData: { data: counselorBase64, mimeType: counselorMimeType } });
    }

    parts.push(mainAudioPart);
    parts.unshift({ text: systemPrompt });

    const result = await model.generateContent(parts);

    return result.response.text();
  }

  throw new Error("지원하지 않는 엔진입니다.");
}
