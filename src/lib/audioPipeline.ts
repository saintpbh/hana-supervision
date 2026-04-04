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
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("보안 정책 및 브라우저 전송 한계로 인해, 현재 브라우저 직접 변환은 20MB 미만의 파일만 지원합니다. 큰 비디오 파일은 음성(mp3, m4a 등)으로 변환 후 업로드해주세요.");
    }

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

    onProgress?.("Gemini 서버로 분석 요청 및 변환 중 (수 분이 소요될 수 있습니다)...");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

    const systemPrompt = `당신은 전문 심리상담 축어록 속기사입니다. 첨부된 상담 오디오를 처음부터 끝까지 빠짐없이 들어보고 매우 정확한 텍스트 축어록을 작성하세요.
    - 화자는 반드시 상담사는 "상1:", 내담자는 "내1:" 로 표기하세요.
    - 화자가 중간에 침묵하거나 대화가 비는 구간(3초 이상)은 반드시 "(...)" 로 표기하세요.
    - 아래 추가 지침을 반드시 준수하세요:
    ${instructions}`;

    const result = await model.generateContent([
      systemPrompt,
      { inlineData: { data: base64Data, mimeType: file.type } }
    ]);

    return result.response.text();
  }

  throw new Error("지원하지 않는 엔진입니다.");
}
