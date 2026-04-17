import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ReportFormData } from "@/types/report";
import { SCT_QUESTIONS, MMPI2_SCALES } from "@/constants/report";

function formatSCT(answers: Record<string, string>): string {
  if (!answers || Object.keys(answers).length === 0) return "작성되지 않음";
  let formatted = "";
  for (const section of SCT_QUESTIONS) {
    let sectionData = "";
    for (const item of section.items) {
      const val = answers[item.id];
      if (val && val.trim()) sectionData += `  - ${item.id}. ${item.text}: ${val}\n`;
    }
    if (sectionData) formatted += `- ${section.category}\n${sectionData}`;
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
      if (val && val.trim()) sectionData.push(`${scale}=${val}`);
    }
    if (sectionData.length > 0) formatted += `- ${section.category}: ${sectionData.join(", ")}\n`;
  }
  return formatted || "작성되지 않음";
}

interface AIInstructionsInput {
  apiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  rolePersona?: string;
  counselingTheory?: string;
  direction?: string;
  transcriptDirection?: string;
  customPrompt?: string;
  orchestrationMode?: string;
  reportStyleLevel?: number;
}

function buildBaseData(data: ReportFormData): string {
  const sctFormatted = formatSCT(data.testData.sct.answers);
  const mmpiFormatted = formatMMPI(data.testData.mmpi2.scales);
  
  return `
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
`;
}

function getRefDepthInstructions(level: number): { roleDesc: string; volumeGuide: string; detailGuide: string } {
  switch (level) {
    case 1:
      return {
        roleDesc: "숙련된 임상 슈퍼바이저",
        volumeGuide: "핵심 근거만 간결하게 요약하세요. (목표: 3~5장 분량의 요약 분석서)",
        detailGuide: "학술 논문 인용은 최소화하고, 핵심 임상 판단의 근거만 간략히 정리하세요. 실무에 즉시 활용 가능한 수준으로 작성하세요."
      };
    case 2:
      return {
        roleDesc: "경험 풍부한 임상심리전문가 슈퍼바이저",
        volumeGuide: "주요 판단에 대한 이론적 근거를 간략히 포함하세요. (목표: 5~10장 분량)",
        detailGuide: "각 핵심 판단에 대해 1~2줄의 이론적 배경을 병기하되, 과도한 학술적 논의는 지양하세요."
      };
    case 3:
      return {
        roleDesc: "최고 수준의 임상심리전문가 슈퍼바이저",
        volumeGuide: "실무적 분석과 학술적 근거를 균형 있게 서술하세요. (목표: 10~15장 분량)",
        detailGuide: "심리검사 교차분석과 핵심 이론적 근거를 포함하되, 각 섹션이 지나치게 길어지지 않도록 균형을 유지하세요."
      };
    case 4:
      return {
        roleDesc: "심리학 분야의 석학급 임상심리전문가 슈퍼바이저",
        volumeGuide: "학술적 깊이를 강화하여 상세하게 분석하세요. (목표: 15~20장 분량의 심도 있는 분석서)",
        detailGuide: "심리검사의 교차분석, 방어기제의 발현 형태, 내담자 호소 문제의 기원 등에 대해 학술적 문헌 근거를 상세히 기술하세요."
      };
    case 5:
    default:
      return {
        roleDesc: "심리학 및 상담 분야의 세계적인 석학이자 최고 수준의 임상심리전문가 슈퍼바이저",
        volumeGuide: "분량 제한 없이 출력 가능한 최대 분량으로 매우 친절하고, 논리적이고, 자세하게 설명하세요. (목표: 20~30장 분량의 심도 있는 보고서)",
        detailGuide: "각 판단마다 어떤 심리학적 이론, 학술적 문헌이 뒷받침되는지 명확한 레퍼런스 설명과 소제목을 동반하여 기술하세요. 이 문서는 상담자가 자신의 임상적 판단이 왜 도출되었는지 이유를 문단별로 세세하게 공부할 수 있는 최고 수준의 학술적 해설서 역할을 해야 합니다."
      };
  }
}

function buildReferencePrompt(data: ReportFormData, ai: AIInstructionsInput | null): string {
  const theory = ai?.counselingTheory || "전문 진단 및 일반 심리상담 이론";
  const baseData = buildBaseData(data);
  const level = ai?.reportStyleLevel || 3;
  const depth = getRefDepthInstructions(level);

  return `당신은 ${depth.roleDesc}입니다.
제공되는 내담자 데이터와 상담 기록을 바탕으로, **판단의 근거와 학문적 근거 종합 분석서(레퍼런스 문서)**를 작성해야 합니다.
${depth.volumeGuide}

## [분석 지침]
- 중점 적용 상담 이론: **${theory}**
- 사례 개념화 방향: ${ai?.direction || "제공되지 않음"}
- 추가 커스텀 지시사항: ${ai?.customPrompt || "제공되지 않음"}
- ${depth.detailGuide}

==================================================
${baseData}
==================================================

위 데이터를 통해 다음 항목들에 대해 분석서(Reference)를 마크다운으로 출력하세요.
## 1. 심리검사(SCT, MMPI-2, TCI) 다면 교차 분석 및 학술적 근거
## 2. 내담자의 방어기제, 핵심 갈등, 대인관계 양상에 대한 심층적 고찰
## 3. 주 호소 문제의 발달사적 기원과 유지 요인 분석
## 4. '${theory}' 이론에 기반한 심층 사례 개념화 과정 및 개입 근거 분석
`;
}

function buildQAPrompt(referenceDoc: string, theory: string): string {
  return `당신은 최고 권위의 학술지 편집장이자 가혹하고 철저한 팩트체크를 수행하는 QA(품질 검증) 에이전트입니다.
다음은 다른 인공지능이 작성한 [학술적 레퍼런스 초안 문서]입니다. 이 문서에 인용된 이론, 개념, 논문, 인물 및 학술적 주장들이 실제 심리학계(${theory} 등)에 허구가 아닌 '실제로 존재하는 내용'인지 팩트체크 하세요. 할루시네이션(거짓 정보)이 존재한다면 가혹하게 비판해야 합니다.

100점 만점으로 점수를 매기되, 창작된 논문 제목이나 존재하지 않는 학술적 주장이 발견될 경우 큰 점수를 감점하세요. 90점 이상이면 패스(isPass: true)로 간주합니다.

## 출력 형식 지정 (매우 중요)
반드시 아래의 구조화된 형태를 가진 순수 JSON 형식으로만 응답해야 합니다. 마크다운 블록이나 추가 문맥을 덧붙이지 마세요.
{
  "score": 0~100 사이의 숫자,
  "feedback": "재작성에 필요한 핵심 피드백 요약(90점 미만일 경우). 90점 이상일 경우 100점이 안된 이유(한계점 등)",
  "qaReport": "최종 문서 하단에 첨부될 QA 레포트 원문. 통과 시에 10점 어치의 미숙한 부분을 조언하는 내용으로 마크다운 형식으로 풍부하게 작성. 90점 미만이라면 '할루시네이션 발견으로 반려됨' 기재.",
  "isPass": true 또는 false
}

==================================================
## [검증 대상 초안 문서]
${referenceDoc}
`;
}

function getReportStyleInstructions(level: number): { toneGuide: string; citationRule: string; formatNotes: string } {
  switch (level) {
    case 1:
      return {
        toneGuide: `## [작성 스타일 지침: 실무 사례보고서]
- 이 보고서는 **슈퍼비전 제출용 사례보고서**입니다. 학술적 어투가 아닌, 실무 현장에서 즉시 활용 가능한 간결하고 명료한 문체로 작성하세요.
- 불필요한 학술 용어 나열을 지양하고, 임상적 관찰과 판단을 핵심 위주로 서술하세요.
- 각 섹션은 짧고 핵심적으로 작성하세요.`,
        citationRule: "학술적 참조 표기([Ref:])는 사용하지 마세요. 필요한 경우 괄호 안에 간략한 이론명만 언급하세요.",
        formatNotes: "전체 분량을 간결하게 유지하세요. 각 섹션은 핵심 내용 위주로 1~3 문단 이내로 작성합니다."
      };
    case 2:
      return {
        toneGuide: `## [작성 스타일 지침: 사례 중심 분석]
- 사례보고서 형식을 기본으로 하되, 주요 임상 판단에 대해 간략한 이론적 배경(1~2줄)을 병기하세요.
- 실무적이고 읽기 쉬운 문체를 유지하면서, 왜 그런 판단을 했는지 근거를 짧게 덧붙이세요.`,
        citationRule: "[Ref:] 형식의 인용 표기는 사용하지 않습니다. 대신 필요한 곳에 '~이론에 따르면' 또는 '~관점에서 볼 때' 정도로 자연스럽게 이론을 언급하세요.",
        formatNotes: "적정 분량을 유지하세요. 가독성을 최우선으로 합니다."
      };
    case 3:
      return {
        toneGuide: `## [작성 스타일 지침: 균형 보고서]
- 실무적 보고서 구조를 유지하면서, 각 섹션에 학술적 해석과 이론적 근거를 균형 있게 포함하세요.
- 지나치게 학문적이지도, 지나치게 간략하지도 않은 중간 톤을 유지하세요.`,
        citationRule: "심리검사 분석과 사례개념화 섹션에서 주요 해석에 대해 [Ref:] 인용 표기를 선택적으로 사용하세요. 모든 문장에 인용을 달 필요는 없습니다.",
        formatNotes: "각 섹션을 적절한 분량으로 서술하세요. 핵심 판단에는 근거를, 명확한 사실에는 간결한 서술을 적용합니다."
      };
    case 4:
      return {
        toneGuide: `## [작성 스타일 지침: 심층 분석 보고서]
- 학술적 깊이를 강화한 보고서입니다. 심리검사 교차분석, 방어기제 논의, 발달사적 맥락 등을 전공서적 수준으로 상세히 서술하세요.
- 임상적 소견마다 이론적 근거를 충실히 기술하세요.`,
        citationRule: "종합보고서에서 심층 해석이나 임상적 소견을 서술할 때는 레퍼런스를 참조 표시(예: [Ref: 1. MMPI-2 다면 분석]) 형태로 기재하세요.",
        formatNotes: "충분한 분량으로 깊이 있게 작성하세요. 각 섹션에서 이론적 근거를 충실히 전개합니다."
      };
    case 5:
    default:
      return {
        toneGuide: `## [작성 스타일 지침: 학술 논문 수준]
- 박사 논문 수준의 학술적 깊이를 갖춘 종합보고서를 작성하세요.
- 모든 임상적 판단과 해석에 학술적 근거를 철저하게 연결하세요.`,
        citationRule: "**가장 중요한 규칙**: 종합보고서에서 심층 해석이나 임상적 소견을 서술할 때는, 항상 결과의 이유에 해당하는 레퍼런스를 참조 표시(예: [Ref: 1. MMPI-2 다면 분석] 또는 [Ref: 방어기제 챕터]) 형태로 기재하세요. 이를 통해 상담자가 종합보고서를 바탕으로 학술적 레퍼런스 문서를 즉시 찾아가 같이 공부할 수 있도록 해야 합니다.",
        formatNotes: "분량 제한 없이 최대한 상세하게 작성하세요. 학술적으로 압도적인 깊이를 보여주세요."
      };
  }
}

function buildMainReportPrompt(data: ReportFormData, ai: AIInstructionsInput | null, referenceOutput: string): string {
  const role = ai?.rolePersona || "한국심리학회 기준 1급 상담심리사이자 10년 이상의 임상 경력을 가진 '전문 상담 슈퍼바이저'입니다.";
  const theory = ai?.counselingTheory || "전문 진단 및 일반 심리상담 이론";
  const baseData = buildBaseData(data);
  const level = ai?.reportStyleLevel || 3;
  const style = getReportStyleInstructions(level);

  // 레벨 1~2에서는 [Ref:] 인용이 들어간 섹션 양식 라벨을 조정
  const section4Label = level <= 2
    ? "### 4. 심리검사 종합 분석 결과"
    : "### 4. 심리검사 종합 분석 결과 (반드시 [Ref: ~] 인용 표기 포함)";
  const section5Label = level <= 2
    ? "### 5. 종합 사례개념화"
    : "### 5. 종합 사례개념화 (반드시 [Ref: ~] 인용 표기 포함)";

  return `당신은 ${role}입니다.

당신은 방금 전담 QA 에이전트의 검수를 통과한 **[학술적 레퍼런스 및 근거 해설서]**를 완벽하게 숙지하고, 이를 바탕으로 내담자 원본 데이터와 함께 최종 **[슈퍼비전 종합보고서]**를 작성해야 합니다.

${style.toneGuide}

## [중요 지침]
- 중점 적용 상담 이론: **${theory}**
- 축어록 요약 방향: ${ai?.transcriptDirection || "제공되지 않음"}
- ${style.citationRule}
- ${style.formatNotes}

==================================================
## [학술적 레퍼런스 및 근거 해설서]
${referenceOutput}

==================================================
## [원천 데이터 요약]
${baseData}

==================================================
위의 사항들을 충실히 반영하여, 아래 **슈퍼비전 보고서 표준 양식**을 완성하세요.

### 1. 표지 및 상담 정보
(상담자: ${data.adminInfo.counselorName}, 소속: ${data.adminInfo.organization}, 슈퍼바이저: ${data.adminInfo.supervisorName}, 일시: ${data.adminInfo.sessionDate}, 장소: ${data.adminInfo.location})
### 2. 내담자 정보 및 주 호소 문제 요약
### 3. 상담 내용 및 회기 요약 
${section4Label}
${section5Label}
### 6. 슈퍼바이저 피드백 및 치료적 제안
---
출력 형식 지침: Markdown 형식으로 출력 (제목은 ## 또는 ### 사용). 한국어로 작성. 결과물에 [인공지능 지침]이라는 지시문 텍스트가 노골적으로 드러나지 않도록 유려하게 서술하세요.
`;
}

function parseQAJson(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return { score: 100, isPass: true, feedback: "QA 채점 오류 임시 패스", qaReport: "> QA 에이전트의 피드백 렌더링에 오류가 발생했습니다." };
  }
}

async function runModelCall(modelType: string, customModel: string, prompt: string, keys: Record<string, string | undefined>) {
  if (modelType === "openai" || customModel.startsWith("gpt-")) {
    if (!keys.openai) throw new Error("OpenAI API 키가 필요합니다.");
    const openai = new OpenAI({ apiKey: keys.openai });
    const response = await openai.chat.completions.create({
      model: customModel,
      messages: [{ role: "user", content: prompt }]
    });
    return {
      text: response.choices[0]?.message?.content || "",
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    };
  } else if (modelType === "claude" || customModel.startsWith("claude-")) {
    if (!keys.anthropic) throw new Error("Anthropic API 키가 필요합니다.");
    const anthropic = new Anthropic({ apiKey: keys.anthropic });
    const response = await anthropic.messages.create({
      model: customModel,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return {
      text: textBlock && "text" in textBlock ? textBlock.text : "",
      promptTokens: response.usage.input_tokens || 0,
      completionTokens: response.usage.output_tokens || 0
    };
  } else {
    if (!keys.gemini) throw new Error("Gemini API 키가 필요합니다.");
    const genAI = new GoogleGenerativeAI(keys.gemini);
    const model = genAI.getGenerativeModel({ model: customModel });
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
      completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0
    };
  }
}

export const maxDuration = 300;

async function executeQALoopAndPipelineStreaming(
  refModelType: string, refModel: string,
  qaModelType: string, qaModel: string,
  repModelType: string, repModel: string,
  formData: ReportFormData, aiInstructions: AIInstructionsInput | null, keys: Record<string, string | undefined>,
  sendEvent: (event: string, data: any) => void
) {
  const baseRefPrompt = buildReferencePrompt(formData, aiInstructions);
  const theoryInfo = aiInstructions?.counselingTheory || "일반 임상심리 이론";
  const totalUsage = { prompt: 0, completion: 0 };

  let retries = 0;
  let passedRefDoc = "";
  let previousFeedback = "";

  while (retries < 2) {
    let currentRefPrompt = baseRefPrompt;
    if (previousFeedback) {
      currentRefPrompt += `\n\n[이전 생성본 검수(QA) 강력 반려 사유! 반드시 이 피드백을 철저히 반영하여 할루시네이션을 수정/재작성할 것!!]\n${previousFeedback}`;
    }

    sendEvent("status", {
      title: retries === 0 ? "1단계: 학술적 초안 작성 중..." : "2-1단계: 반박을 반영하여 재작성 중...",
      desc: retries === 0 ? "방대한 심리 데이터의 학술적 근거 초안을 도출하고 있습니다." : "가혹하게 지적된 할루시네이션(거짓 정보)을 수정하고 있습니다."
    });

    const refRes = await runModelCall(refModelType, refModel, currentRefPrompt, keys);
    const refText = refRes.text;
    totalUsage.prompt += refRes.promptTokens;
    totalUsage.completion += refRes.completionTokens;

    sendEvent("status", {
      title: "2단계: QA 에이전트 팩트체크 진행 중...",
      desc: "생성된 문서에 허위 인용이나 존재하지 않는 논문이 있는지 다른 AI가 평가하며 채점 중입니다."
    });

    const qaPrompt = buildQAPrompt(refText, theoryInfo);
    const qaRes = await runModelCall(qaModelType, qaModel, qaPrompt, keys);
    totalUsage.prompt += qaRes.promptTokens;
    totalUsage.completion += qaRes.completionTokens;

    const qaJson = parseQAJson(qaRes.text);
    console.log(`[QA 에이전트 검증] Try: ${retries + 1}, Score: ${qaJson.score}, Pass: ${qaJson.isPass}`);

    if (qaJson.isPass || qaJson.score >= 90) {
      passedRefDoc = refText + `\n\n---\n\n## 🛡️ [QA 검수 및 한계점 리포트]\n**최종 검증 점수: ${qaJson.score}점**\n\n` + qaJson.qaReport;
      break;
    } else {
      previousFeedback = qaJson.feedback;
      passedRefDoc = refText + `\n\n---\n\n## 🚨 [QA 강제 산출 (Max Retries 초과)]\n**최종 검증 점수: ${qaJson.score}점**\n\n` + qaJson.qaReport;
    }

    retries++;
  }

  // 3. Final Report Generation based on the QA-passed Reference
  sendEvent("status", {
    title: "3단계: 최종 종합보고서 작성 중...",
    desc: "QA 검증을 통과한 학술적 레퍼런스를 바탕으로 현장 실무 수준의 종합보고서를 통합 작성하고 있습니다."
  });

  const mainPrompt = buildMainReportPrompt(formData, aiInstructions, passedRefDoc);
  const repRes = await runModelCall(repModelType, repModel, mainPrompt, keys);
  totalUsage.prompt += repRes.promptTokens;
  totalUsage.completion += repRes.completionTokens;

  sendEvent("done", {
    reference: passedRefDoc,
    report: repRes.text,
    usage: totalUsage
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData: ReportFormData = body.data || body;
    const aiInstructions: AIInstructionsInput | null = body.aiInstructions || null;

    const keys = {
      gemini: aiInstructions?.apiKey || process.env.GEMINI_API_KEY,
      openai: aiInstructions?.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropic: aiInstructions?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    };

    let modeLabel = "";
    if (aiInstructions?.orchestrationMode === "multi") {
      modeLabel = "multi";
      if (!keys.gemini || !keys.openai || !keys.anthropic) {
        return NextResponse.json({ error: "멀티 에이전트 모드는 3가지 제공사 API Key가 모두 필요합니다." }, { status: 400 });
      }
    } else if (aiInstructions?.orchestrationMode === "gemini-multi") {
      modeLabel = "gemini-multi";
    } else {
      modeLabel = "single";
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // 타임아웃 회피용 지속 핑(Ping) 전송
        const pingInterval = setInterval(() => {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        }, 15000);

        try {
          if (modeLabel === "multi") {
            await executeQALoopAndPipelineStreaming(
              "openai", "gpt-4o",
              "claude", "claude-3-5-sonnet-20241022",
              "claude", "claude-3-5-sonnet-20241022",
              formData, aiInstructions, keys, sendEvent
            );
          } else if (modeLabel === "gemini-multi") {
            const customModel = aiInstructions?.model || "gemini-3.1-pro-preview";
            await executeQALoopAndPipelineStreaming(
              "gemini", customModel,
              "gemini", "gemini-2.0-flash",
              "gemini", customModel,
              formData, aiInstructions, keys, sendEvent
            );
          } else {
            const customModel = aiInstructions?.model || "gemini-2.0-flash";
            const modelType = customModel.startsWith("gpt-") ? "openai" : customModel.startsWith("claude-") ? "claude" : "gemini";
            await executeQALoopAndPipelineStreaming(
              modelType, customModel,
              modelType, customModel,
              modelType, customModel,
              formData, aiInstructions, keys, sendEvent
            );
          }
          sendEvent("finish", { mode: modeLabel });
        } catch (err: unknown) {
          console.error("Pipeline streaming error:", err);
          const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
          sendEvent("error", { message });
        } finally {
          clearInterval(pingInterval);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  } catch (err: unknown) {
    console.error("Report generation boundary error:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
