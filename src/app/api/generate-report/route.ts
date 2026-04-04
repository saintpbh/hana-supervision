import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { ReportFormData } from "@/types/report";
import { THEORY_LABELS } from "@/types/report";
import { SCT_QUESTIONS, MMPI2_SCALES } from "@/constants/report";

function formatSCT(answers: Record<string, string>): string {
  if (!answers || Object.keys(answers).length === 0) return "작성되지 않음";
  
  let formatted = "";
  for (const section of SCT_QUESTIONS) {
    let sectionData = "";
    for (const item of section.items) {
      const val = answers[item.id];
      if (val && val.trim()) {
        sectionData += `  - ${item.id}. ${item.text}: ${val}\n`;
      }
    }
    if (sectionData) {
      formatted += `- ${section.category}\n${sectionData}`;
    }
  }
  return formatted || "작성되지 않음";
}

function formatMMPI(scales: Record<string, string>): string {
  if (!scales || Object.keys(scales).length === 0) return "작성되지 않음";

  let formatted = "";
  for (const section of MMPI2_SCALES) {
    const sectionData = [];
    for (const scale of section.scales) {
      const val = scales[scale];
      if (val && val.trim()) {
        sectionData.push(`${scale}=${val}`);
      }
    }
    if (sectionData.length > 0) {
      formatted += `- ${section.category}: ${sectionData.join(", ")}\n`;
    }
  }
  return formatted || "작성되지 않음";
}

interface AIInstructionsInput {
  apiKey?: string;
  model?: string;
  selectedTheories?: string[];
  direction?: string;
  transcriptDirection?: string;
  customPrompt?: string;
}

function buildPrompt(data: ReportFormData, ai: AIInstructionsInput | null): string {
  const theories = ai?.selectedTheories || [];
  const theoryNames = theories.map((t: string) => THEORY_LABELS[t as keyof typeof THEORY_LABELS]).join(", ") || "일반 심리상담";
  
  const sctFormatted = formatSCT(data.testData.sct.answers);
  const mmpiFormatted = formatMMPI(data.testData.mmpi2.scales);

  return `당신은 최소 15년 이상의 임상 경험을 가진 전문 심리상담학 슈퍼바이저입니다.
당신은 다음의 [인공지능 지침]을 최우선으로 숙지한 후, 제공되는 상담 맥락과 심리분석 결과를 해석해야 합니다.

## [인공지능 지침]
- 중점 적용 상담 이론: **${theoryNames}**
- 사례 개념화 및 분석 방향: ${ai?.direction || "제공되지 않음"}
- 축어록 요약 방향: ${ai?.transcriptDirection || "제공되지 않음"}
- 추가 커스텀 지시사항: ${ai?.customPrompt || "제공되지 않음"}

==================================================
아래의 내담자 정보와 상담 내역을 먼저 읽고 내담자의 상황과 맥락을 이해하세요.

## [내담자 정보 및 상담 맥락]
- 내담자 연령/성별: ${data.clientProfile.age} / ${data.clientProfile.gender}
- 직업: ${data.clientProfile.occupation}
- 주 호소 문제: ${data.clientProfile.chiefComplaint}
- 상담 동기 및 경위: ${data.clientProfile.counselingMotivation}

### 최근 상담 회기 요약 (제 ${data.sessionSummary.sessionNumber})
- 주요 상담 내용: ${data.sessionSummary.sessionContent}
- 핵심 축어록: ${data.sessionSummary.keyTranscripts}
- 상담자 소견: ${data.sessionSummary.counselorObservation}
- 슈퍼비전 요청사항: ${data.sessionSummary.supervisionRequest}

==================================================
내담자의 맥락이 이해되었다면, 다음 심리검사 데이터를 확인하고 앞서 제시된 [인공지능 지침]에 근거하여 심도 있게 해석하세요.

## [심리검사 데이터]
### SCT (문장완성검사)
${sctFormatted}
- 해석 포인트 및 종합 소견: ${data.testData.sct.interpretation || "없음"}

### MMPI-2
${mmpiFormatted}
- 코드 타입: ${data.testData.mmpi2.codeType || "없음"}
- 유의미한 상승 척도 요약: ${data.testData.mmpi2.significantScales || "없음"}

### TCI (기질 및 성격검사)
- 자극추구(NS): ${data.testData.tci.noveltySeekingNS} | 위험회피(HA): ${data.testData.tci.harmAvoidanceHA} | 사회적 민감성(RD): ${data.testData.tci.rewardDependenceRD} | 인내력(P): ${data.testData.tci.persistenceP}
- 자율성(SD): ${data.testData.tci.selfDirectednessSD} | 연대감(C): ${data.testData.tci.cooperativenessC} | 자기초월(ST): ${data.testData.tci.selfTranscendenceST}

==================================================
위의 모든 정보를 종합하여 아래 **슈퍼비전 보고서 표준 양식**을 완성하세요.

## 슈퍼비전 보고서 표준 양식 (다음 섹션을 반드시 포함하고 순서를 준수하세요)

### 1. 표지 및 행정 정보
(상담자: ${data.adminInfo.counselorName}, 소속: ${data.adminInfo.organization}, 슈퍼바이저: ${data.adminInfo.supervisorName}, 일시: ${data.adminInfo.sessionDate}, 장소: ${data.adminInfo.location})

### 2. 내담자 정보 및 주 호소 문제 요약
(제공된 내담자 기본 정보를 간략히 요약)

### 3. 상담 내용 및 회기 요약 
(제공된 상담 과정 요약 데이터를 보고서 형식으로 세련되게 정리. 축어록 요약 방향 지침을 적용하세요.)

### 4. 심리검사 결과 및 깊이 있는 해석
([인공지능 지침]의 방향성과 선택된 이론(${theoryNames})을 적용하여 SCT, MMPI-2, TCI의 결과를 서로 교차-해석하세요.)

### 5. 사례개념화 (Case Conceptualization)
(선택된 이론별로 소제목을 달아 개별적인 사례개념화를 작성하세요. 다음 요소를 꼭 포함하세요: 핵심 감정/갈등, 방어기제/대처, 대인관계 패턴, 발달사적 관점)

### 6. 슈퍼바이저 피드백 및 치료적 제안
(상담자의 '슈퍼비전 요청사항'에 대한 답변을 포함하여, 구체적인 치료 방향성을 제안하세요.)

---
## 출력 형식 지침
- Markdown 형식으로 출력하세요. (제목은 ## 또는 ### 사용)
- 객관적 사실과 전문적 해석을 명확히 구분하여 기술하세요.
- 한국어로 작성하세요. 전문 용어에는 괄호 안에 영문 원어를 병기하세요.
- 결과물에 [인공지능 지침]이라는 텍스트가 노골적으로 드러나지 않도록, 내용에 자연스럽게 녹여내세요.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData: ReportFormData = body.data || body;
    const aiInstructions: AIInstructionsInput | null = body.aiInstructions || null;
    const prompt = buildPrompt(formData, aiInstructions);

    const apiKey = aiInstructions?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다. 인공지능 설정에서 키를 입력하거나, 환경 변수를 설정하세요." },
        { status: 400 }
      );
    }

    const customModel = aiInstructions?.model || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: customModel });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ report: text });
  } catch (err: unknown) {
    console.error("Report generation error:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
